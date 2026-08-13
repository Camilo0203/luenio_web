# Luenio

Sitio de **lead generation** para vender landings y automatizaciones con IA.

- **Público:** quiénes somos, cotización, demos por nicho, legales y captura de leads.
- **Reservado para después:** login, invitaciones y CRM, cerrados con `PUBLIC_DEMO_MODE=true`.
- **Ops:** Node + Vite, Supabase, n8n, Caddy, Docker, Cloudflare.

El scoring es **por reglas** (léxico de intención), no un LLM. Las landings de nicho son **demostrativas**.

## Stack

| Capa           | Tecnología                                                 |
| -------------- | ---------------------------------------------------------- |
| Runtime        | Node.js `^20.19.0 \|\| >=22.12.0`                          |
| Front          | HTML/CSS/JS + Vite 8                                       |
| API            | `server.js` + `api/` (handlers delgados + `api/services/`) |
| Core           | `core/` (scoring, pipeline, lead-engine)                   |
| Datos          | Supabase (prod) o JSON local (dev)                         |
| Automatización | n8n (webhooks autenticados)                                |
| Edge           | Cloudflare + Caddy                                         |

## Estructura

```text
apps/web      Sitio público, demos y nichos
apps/admin    Login, invitaciones, CRM
api/          Handlers HTTP y servicios
core/         Scoring, pipeline, eventos
db/           Frontera de almacenamiento
config/       Env y readiness
scripts/      Tests y preflight
n8n/          Workflows importables
ops/          Firewall, backup, monitores
supabase/     schema.sql
```

## Arranque local

```bash
cp .env.example .env
npm ci
npm run dev
```

Por defecto: [http://127.0.0.1:4180](http://127.0.0.1:4180)

| Ruta          | Uso                   |
| ------------- | --------------------- |
| `/`           | Landing               |
| `/cotizacion` | Cotización (lead-gen) |
| `/demos`      | Catálogo demostrativo |
| `/api/health` | Liveness              |

`PUBLIC_DEMO_MODE=true` redirige `/login`, invitaciones, reset, `/dashboard`, `/app`, `/crm` y
archivos administrativos hacia `/demos`; sus APIs responden `404`. El código privado permanece en
el repositorio para reactivarlo posteriormente. El CRM de agencia también conserva
`ENABLE_AGENCY_CRM=false`.

## Scripts

| Comando                         | Descripción                                        |
| ------------------------------- | -------------------------------------------------- |
| `npm run dev`                   | Servidor completo (API + estáticos)                |
| `npm run build`                 | Build Vite → `dist/`                               |
| `npm test`                      | Production gate (suite completa)                   |
| `npm run test:quick`            | Gate diario: lint, build, arquitectura, API y core |
| `npm run lint` / `format:check` | Calidad de código                                  |
| `npm run readiness:report`      | Checklist de readiness en consola                  |
| `npm run preflight:production`  | Validación fail-closed pre-deploy                  |

## Auth y billing (reservados)

- El acceso, las invitaciones, el reset y MFA no forman parte de la superficie activa.
- Al reactivar el portal, seguirá sin existir registro público y MFA será obligatorio para admins.
- **Billing self-serve desactivado** (`ENABLE_PUBLIC_BILLING=false`). La venta pública es por cotización.

## CRM conservado para una fase posterior

El código de `/dashboard` se conserva, pero no es accesible con el modo público activo. Incluye:

- Notas, etiquetas, búsqueda y export CSV
- **Próxima acción** + fecha
- **Registro de contactos** (WhatsApp / llamada / email / nota)
- **Cola de hoy** y filtros (vencen hoy, calientes sin tocar, sin contacto)
- Plantillas de respuesta WhatsApp
- Onboarding guiado de 4 pasos
- Vista previa de **digest** diario (`POST /api/process` `{ "mode": "digest" }`)

Contrato HTTP: [docs/API.md](./docs/API.md). Migraciones SQL: `supabase/migrations/`.

## Documentación

| Doc                                                                | Contenido                             |
| ------------------------------------------------------------------ | ------------------------------------- |
| [docs/ROADMAP.md](./docs/ROADMAP.md)                               | P0 publicable → P1 CRM → P2 escala    |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)                     | Flujos, cajas, dónde va la lógica     |
| [docs/RUNBOOK.md](./docs/RUNBOOK.md)                               | Incidentes, health, rotación, restore |
| [docs/CRM.md](./docs/CRM.md)                                       | Cómo usar el dashboard                |
| [docs/API.md](./docs/API.md)                                       | Contrato HTTP                         |
| [docs/CHECKLIST-PRODUCCION.md](./docs/CHECKLIST-PRODUCCION.md)     | Ops humana pre-launch                 |
| [DEPLOYMENT.md](./DEPLOYMENT.md)                                   | Cloudflare / Caddy / Docker           |
| [PRODUCTION.md](./PRODUCTION.md)                                   | Comportamiento de producción          |
| [SECURITY.md](./SECURITY.md)                                       | Controles e incidentes                |
| [n8n/README.md](./n8n/README.md)                                   | Workflows de correo y MFA             |
| [CHANGELOG.md](./CHANGELOG.md)                                     | Historial de versiones                |
| [supabase/bootstrap.example.sql](./supabase/bootstrap.example.sql) | Plantilla primer admin (sin secretos) |

## Tests

```bash
npm test
```

Los tests son self-contained (JSON fallback, sin Supabase real). En Windows, el gate completo puede tardar unos 10 minutos.

Para actualizar una referencia visual aprobada sin reemplazar las demás:

```bash
node scripts/visual-regression-test.mjs --update --scenario=home-light-desktop
```

## Licencia

Proyecto privado (`"private": true`).
