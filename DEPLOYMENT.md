# Luenio — Despliegue en VPS con Docker

Guía end-to-end para desplegar Luenio en un VPS propio usando Docker Compose (app + Caddy como reverse proxy con TLS automático). Ver `PRODUCTION.md` para la configuración a nivel de aplicación (variables de entorno, Supabase, Stripe, etc.) — esta guía cubre solo la infraestructura.

## 1. Overview

Un único VPS ejecuta dos contenedores vía Docker Compose:

- `app`: la imagen de Luenio (Node.js, sin dependencias de runtime, sirve el build de Vite).
- `caddy`: reverse proxy que obtiene y renueva automáticamente el certificado TLS (Let's Encrypt).

Supabase es el backend gestionado de base de datos; Stripe procesa los pagos.

## 2. Prerequisitos

- VPS con Ubuntu 22.04/24.04 o Debian 12, IP pública.
- Un dominio con registro A (y AAAA si aplica) apuntando a la IP del VPS.
- Acceso SSH con un usuario con permisos sudo.
- Firewall abierto solo para 22/80/443:
  ```bash
  sudo ufw allow OpenSSH
  sudo ufw allow 80
  sudo ufw allow 443
  sudo ufw enable
  ```
- Docker Engine + Compose plugin:
  ```bash
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker $USER
  ```
  (cierra sesión y vuelve a entrar para que el grupo `docker` tome efecto)
- `git` instalado.

## 3. Pre-deploy gate — corre `npm test` ANTES de tocar el VPS

`scripts/production-gate.mjs` levanta su propio servidor temporal en un puerto libre, espera a `/api/health` y corre toda la batería de guardas (arquitectura, seguridad de auth, límites de tasa, schema, storage, webhook de Stripe, smoke dev/prod, e2e completo). Necesita un working tree escribible, un puerto disponible y tiempo real de ejecución — nada de eso pertenece dentro de una capa de `docker build`.

```bash
npm ci
npm test
```

Corrige cualquier fallo antes de continuar.

## 4. Llevar el código al VPS

Opción A — repo remoto (recomendado si ya tienes GitHub/GitLab):

```bash
git clone <url-del-remoto> luenio-app
cd luenio-app
```

Opción B — sin remoto, copiar directamente:

```bash
rsync -avz --exclude node_modules --exclude dist --exclude .git ./ user@vps:/opt/luenio-app/
```

## 5. Crear el `.env` de producción en el VPS

```bash
cp .env.example .env
nano .env
```

**⚠️ Importante**: borra (o corrige) las líneas `NODE_ENV`, `HOST` y `PORT` copiadas de `.env.example` (que trae valores de desarrollo local: `development`/`127.0.0.1`). La imagen Docker ya trae horneados los valores seguros de producción (`NODE_ENV=production`, `HOST=0.0.0.0`, `PORT=4180`) — si `env_file` los sobreescribe con los valores de desarrollo, se rompen tanto la seguridad de las cookies como el servido de archivos estáticos (el contenedor de runtime solo tiene `dist/`, no las fuentes de `apps/`).

Luego completa con valores reales:

- Genera `AUTH_SECRET`: `openssl rand -hex 32`.
- Corre `supabase/schema.sql` en el editor SQL de tu proyecto Supabase, luego completa `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` y pon `REQUIRE_SUPABASE=true`.
- Completa `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (de un endpoint de webhook apuntando a `https://tu-dominio/api/stripe-webhook`) y los 3 `STRIPE_*_PRICE_ID`.
- Pon `COOKIE_SECURE=true` y `APP_URL=https://tu-dominio-real.com` (debe ser HTTPS — `config/readiness.js` lo exige explícitamente para considerar el despliegue "listo").
- `chmod 600 .env`.

## 6. Construir y levantar

```bash
docker compose build
docker compose up -d
docker compose ps
docker compose logs -f app
```

## 7. Reverse proxy y TLS

**Opción recomendada — Caddy incluido**: edita el dominio en `Caddyfile`, luego:

```bash
docker compose up -d caddy
```

Caddy emite y renueva el certificado Let's Encrypt automáticamente vía ACME HTTP-01 (requiere DNS ya apuntado y puertos 80/443 abiertos).

**Alternativa — Nginx + Certbot en el host**: publica el puerto de `app` (`127.0.0.1:4180:4180` en `docker-compose.yml`, descomentando esa línea) y usa un bloque mínimo:

```nginx
server {
    listen 80;
    server_name tu-dominio-real.com;
    location / {
        proxy_pass http://127.0.0.1:4180;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

luego `sudo certbot --nginx -d tu-dominio-real.com`.

**Crítico en cualquier caso**: el proxy debe reenviar sin modificar los headers `Host`, `X-Forwarded-For` y `X-Forwarded-Proto` — `server.js` usa `x-forwarded-for` para el rate-limit por IP y `Host` para la validación de mismo origen. Un proxy mal configurado hace que todos los visitantes compartan el mismo bucket de rate-limit o que fallen los checks de origen.

## 8. Verificar

```bash
curl https://tu-dominio-real.com/api/health
```

Debe mostrar `storage.mode: "supabase"` y `readiness.criticalReady: true`. Verifica manualmente `/`, `/login`, `/dashboard`, `/precios`, `/terminos`, `/privacidad`, `/reembolsos`.

## 9. Actualizar / redeploy

```bash
git pull
docker compose build app
docker compose up -d app
docker image prune -f
```

(Caddy no necesita reiniciarse salvo que cambies el `Caddyfile`.)

## 10. Backups

Supabase gestiona los backups de Postgres (revisa tu plan para point-in-time recovery). Si en algún momento usas el fallback local JSON en producción (no recomendado), respalda el volumen:

```bash
docker run --rm -v luenio_db:/data -v $(pwd):/backup alpine tar czf /backup/leads-db-backup.tgz /data
```

## 11. Rollback

```bash
git checkout <commit-o-tag-anterior>
docker compose build app
docker compose up -d app
```
