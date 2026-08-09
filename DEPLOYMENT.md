# Despliegue seguro de Luenio

Esta guía publica Luenio en un VPS compartido con aislamiento estricto entre staging y producción. Los recursos externos —Cloudflare, Supabase, Resend, GA4, Sentry, R2 y Better Stack— también deben estar separados por entorno cuando admitan datos o secretos.

## Arquitectura

```text
Cloudflare -> Caddy compartido (80/443)
                 |-> app-production + n8n-production
                 `-> app-staging + n8n-staging

app-production -> Supabase production
app-staging    -> Supabase staging
backups        -> Cloudflare R2 cifrado con age
monitoreo      -> Better Stack + timers locales
```

Caddy es el único servicio con puertos públicos. Cada stack de aplicación tiene una red edge exclusiva y redes internas separadas para app y n8n. Los stacks no comparten archivos `.env`, secretos, proyectos Supabase, volúmenes n8n ni aliases Docker.

## 1. Preparar el VPS

- Ubuntu 24.04 LTS o Debian estable actualizado.
- Al menos 4 GB RAM y espacio suficiente para dos stacks durante la promoción.
- Docker Engine con Compose plugin, `age`, `rclone` y `curl`.
- SSH con llave, root y contraseña deshabilitados, MFA en proveedores.
- Repositorio en `/opt/luenio`.

Crea los archivos root-only:

```bash
sudo install -d -m 700 /etc/luenio
sudo cp .env.production.example /etc/luenio/production.env
sudo cp .env.production.example /etc/luenio/staging.env
sudo cp .env.edge.example /etc/luenio/edge.env
sudo cp .env.backup.example /etc/luenio/backup.env
sudo cp .env.monitor.example /etc/luenio/monitor.env
sudo chmod 600 /etc/luenio/*.env
```

Genera cada secreto independientemente con `openssl rand -hex 32`. No reutilices secretos entre entornos ni entre webhooks.

## 2. Contratos por entorno

Producción:

```dotenv
LUENIO_IMAGE=luenio:<release-inmutable>
LUENIO_ENV_FILE=/etc/luenio/production.env
APP_HOST=luenio.com
APP_EDGE_ALIAS=app-production
N8N_EDGE_ALIAS=n8n-production
EDGE_NETWORK=luenio-production-edge
APP_URL=https://luenio.com
ALLOWED_HOSTS=luenio.com,www.luenio.com
TURNSTILE_ALLOWED_HOSTNAMES=luenio.com,www.luenio.com
N8N_HOST=automation.luenio.com
SENTRY_ENVIRONMENT=production
```

Staging:

```dotenv
LUENIO_IMAGE=luenio:<misma-release-inmutable>
LUENIO_ENV_FILE=/etc/luenio/staging.env
APP_HOST=staging.luenio.com
APP_EDGE_ALIAS=app-staging
N8N_EDGE_ALIAS=n8n-staging
EDGE_NETWORK=luenio-staging-edge
APP_URL=https://staging.luenio.com
ALLOWED_HOSTS=staging.luenio.com
TURNSTILE_ALLOWED_HOSTNAMES=staging.luenio.com
N8N_HOST=automation-staging.luenio.com
SENTRY_ENVIRONMENT=staging
```

Cada archivo debe tener su propio Supabase, Turnstile, `AUTH_SECRET`, proxy, health, tokens n8n, DSN de Sentry y Measurement ID de GA4. `REQUIRE_SUPABASE`, `TURNSTILE_REQUIRED`, `ADMIN_MFA_REQUIRED` y `LEGAL_IDENTITY_READY` deben ser `true` antes de publicar producción. `ENABLE_PUBLIC_BILLING` permanece `false`.

El archivo edge usa secretos proxy distintos para ambos entornos. El secreto de cada bloque debe coincidir exactamente con su aplicación.

## 3. Servicios administrados

1. Crea proyectos Supabase separados. Ejecuta `supabase/schema.sql`, valida RLS con una clave anon y crea el primer admin manualmente.
2. Configura Resend SMTP, verifica dominio, SPF, DKIM y DMARC. Crea credenciales separadas para staging y producción.
3. Importa los workflows de `n8n/workflows/` en cada instancia. Usa una credencial Header Auth distinta por webhook y entorno.
4. Crea propiedades o flujos GA4 separados; GA4 es parte del gate y solo carga después del consentimiento.
5. Crea proyectos Sentry separados o entornos estrictamente filtrados. Configura DSN público y servidor, release y environment.
6. Crea bucket R2 y remoto `rclone`; conserva la identidad privada de `age` fuera del VPS.
7. Configura Better Stack para health público, TLS y alertas. No entregues `HEALTHCHECK_TOKEN` a un tercero sin almacén cifrado.

Protege ambos editores n8n con Cloudflare Access y MFA. Los paths `/webhook/*` usan Service Auth o bypass limitado más su bearer token.

## 4. Gate local

```bash
npm ci
npm audit --audit-level=high
npm test
npm run lint
npm run format:check
npm run build
```

En el VPS valida cada archivo real:

```bash
set -a
. /etc/luenio/staging.env
set +a
npm run preflight:production

set -a
. /etc/luenio/production.env
set +a
npm run preflight:production

set -a
. /etc/luenio/edge.env
set +a
npm run preflight:edge
```

## 5. Desplegar y promover

Construye una imagen inmutable en staging:

```bash
sudo bash ops/deploy-environment.sh staging /etc/luenio/staging.env --build
sudo bash ops/deploy-edge.sh /etc/luenio/edge.env
docker compose -p luenio-staging --env-file /etc/luenio/staging.env ps
```

Prueba staging completamente. Después copia el mismo valor `LUENIO_IMAGE` a producción y promueve sin reconstruir:

```bash
sudo bash ops/deploy-environment.sh production /etc/luenio/production.env --no-build
docker compose -p luenio-production --env-file /etc/luenio/production.env ps
```

Nunca promociones un tag mutable como `latest`. Conserva la imagen anterior para rollback.

## 6. Cloudflare y bloqueo del origen

Configura proxied DNS para `luenio.com`, `www`, `staging`, `automation` y `automation-staging`; TLS Full (strict), WAF, protección de bots y rate limits de `SECURITY.md`.

```bash
sudo ADMIN_IP_CIDR=TU_IP/32 sh ops/configure-origin-firewall.sh
ORIGIN_IP=IP_VPS sh ops/verify-origin-lockdown.sh
```

No publiques mientras la conexión directa al origen tenga éxito.

## 7. Validación de staging

- Formulario real y Turnstile.
- Persistencia con n8n apagado y entrega al restaurarlo.
- Resend recibido y autenticado.
- Invitación, expiración, recuperación y MFA admin.
- Aislamiento entre dos empresas y acceso anon denegado.
- Eventos GA4 de navegación, CTA, WhatsApp, inicio y éxito/error de cotización.
- Error deliberado visible en Sentry sin PII.
- Responsive, teclado, 200% zoom y navegadores objetivo.
- Alerta Better Stack y restauración de backup R2 cifrado.

Staging y sus automatizaciones deben responder con `X-Robots-Tag: noindex, nofollow`.

## 8. Health, timers y backups

```bash
curl https://luenio.com/api/health
curl -H "Authorization: Bearer $HEALTHCHECK_TOKEN" \
  "https://luenio.com/api/health?details=1"
```

El diagnóstico autenticado debe mostrar `criticalReady: true` y `storage.mode: "supabase"`.

Instala las unidades de `ops/systemd/` y activa:

```bash
sudo systemctl enable --now luenio-health@production.timer
sudo systemctl enable --now luenio-health@staging.timer
sudo systemctl enable --now luenio-backup.timer
sudo systemctl enable --now luenio-security-maintenance.timer
```

Prueba `ops/restore-volumes.sh` sobre un volumen vacío antes del lanzamiento y luego trimestralmente.

## 9. Rollback

Restaura el tag inmutable anterior en el `.env` del entorno y ejecuta:

```bash
sudo bash ops/deploy-environment.sh production /etc/luenio/production.env --no-build
```

Un rollback de imagen no revierte migraciones. Las migraciones destructivas requieren backup y procedimiento probado en staging.
