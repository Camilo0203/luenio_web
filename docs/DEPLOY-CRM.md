# Despliegue CRM premium (Luenio)

Mapa dual `/dashboard` vs `/crm`: ver [CRM-MAP.md](./CRM-MAP.md).

## URL local (verificada)

- App agency: http://127.0.0.1:4180/crm
- App leads: http://127.0.0.1:4180/dashboard
- API health: http://127.0.0.1:4180/api/crm/health
- Dashboard JSON: http://127.0.0.1:4180/api/crm/dashboard

Datos agency: Neon project `luenio-crm` vía `DATABASE_URL`.

Smoke:

```bash
npm run test:crm-api
```

## Variables de entorno de producción

| Variable              | Uso                                                                   |
| --------------------- | --------------------------------------------------------------------- |
| `DATABASE_URL`        | Neon Postgres (obligatoria para `/crm` + `/api/crm`)                  |
| `SENTRY_DSN_SERVER`   | Backend Sentry (obligatoria en producción)                            |
| `SENTRY_DSN_PUBLIC`   | Frontend Sentry (obligatoria en producción)                           |
| `SENTRY_RELEASE`      | Tag inmutable de la imagen desplegada                                 |
| `SENTRY_ENVIRONMENT`  | `production`                                                          |
| `CRM_PUBLIC`          | **Dejar en false / omitir en prod.** Si `true`, `/crm` no exige login |
| `CRM_API_PUBLIC`      | **Solo demos.** Si `true`, API CRM sin sesión en prod                 |
| `CRM_DEBUG_ENDPOINTS` | Solo si necesitas `GET /api/crm/debug/error` en prod                  |
| `NODE_ENV`            | `production`                                                          |
| `PORT` / `HOST`       | Runtime                                                               |

## Docker (recomendado — producción)

```bash
npm run build
docker build -t luenio-crm .
docker run --rm -p 4180:4180 \
  -e DATABASE_URL="$DATABASE_URL" \
  -e SENTRY_DSN_SERVER="$SENTRY_DSN_SERVER" \
  -e NODE_ENV=production \
  luenio-crm
```

Por defecto (y en `Dockerfile` si aplica) `CRM_PUBLIC` no es `true`: hace falta sesión para `/crm` y `/api/crm/*` (excepto `health`).

### Solo demo pública (no usar en prod real)

```bash
docker run --rm -p 4180:4180 \
  -e DATABASE_URL="$DATABASE_URL" \
  -e CRM_PUBLIC=true \
  -e CRM_API_PUBLIC=true \
  -e NODE_ENV=production \
  luenio-crm
```

## Vercel

Requiere login: `npx vercel login`

Este stack es un servidor Node HTTP propio (no Next.js). Opciones:

1. **Docker en un host** (Railway, Fly.io, VPS + Caddy) — alineado con `Dockerfile`.
2. **Cloudflare Tunnel** permanente hacia el contenedor/host.
3. **Vercel** solo si adaptas a serverless (no está cableado por defecto).

```bash
npx vercel login
npx vercel env add DATABASE_URL
npx vercel env add SENTRY_DSN_SERVER
npx vercel --prod
```

## Sentry

- Sin DSN: fallos se registran en `.sentry-local.log` únicamente en desarrollo.
- Con ambos DSN: `@sentry/node` y `@sentry/browser` envían a Sentry; el cliente se carga dinámicamente y elimina PII antes de enviar.
- Probe controlado: `GET /api/crm/debug/error` (solo dev o `CRM_DEBUG_ENDPOINTS=true`).

## Cloudflare quick tunnel (temporal)

```bash
npx cloudflared tunnel --url http://127.0.0.1:4180
```

La URL `*.trycloudflare.com` es efímera y no garantiza uptime.
