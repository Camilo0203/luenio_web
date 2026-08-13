# CRM Map — producto activo y laboratorio (Luenio)

El portal privado completo queda reservado para una fase posterior. Con `PUBLIC_DEMO_MODE=true`,
`/login`, invitaciones, reset, `/dashboard`, `/app`, `/crm`, sus archivos y APIs están cerrados. El
código de `/dashboard` sobre Supabase y el laboratorio `/crm` sobre Neon se conservan sin migrar ni
mezclar bases de datos. `ENABLE_AGENCY_CRM=false` sigue siendo obligatorio.

## Entrada de producto (profesional)

Flujo futuro, actualmente deshabilitado:

1. Sitio público → botón **Acceso clientes** → login
2. Login (Turnstile si `TURNSTILE_REQUIRED`, MFA admin si aplica, “confiar dispositivo 30 días”)
3. Redirect seguro `?next=` hacia **`/dashboard`**
4. `/app` y `/crm` redirigen a `/dashboard` mientras el laboratorio esté apagado
5. Switcher **Espacios | Leads | Agencia** en cada módulo
6. `localStorage.luenio-workspace` recuerda el último módulo

### Auth API (extra)

| Action                                     | Uso                                                   |
| ------------------------------------------ | ----------------------------------------------------- |
| `login` / `verify_mfa` / `logout`          | Sesión                                                |
| `list_sessions` / `GET ?sessions=1`        | Listar sesiones                                       |
| `revoke_session` / `revoke_other_sessions` | Cerrar sesiones                                       |
| Bootstrap admin                            | `npm run auth:create-admin -- --email … --password …` |

| Ruta amigable | Rol                            |
| ------------- | ------------------------------ |
| `/login`      | Acceso                         |
| `/app`        | Selector de espacio de trabajo |
| `/dashboard`  | Módulo Leads                   |
| `/crm`        | Módulo Agencia                 |

## Superficies

|              | `/dashboard`                                    | `/crm`                                                          |
| ------------ | ----------------------------------------------- | --------------------------------------------------------------- |
| **Producto** | CRM **Leads operativos** (inbound, score, cola) | CRM **Agencia** (cartera, pipeline, facturación)                |
| **Título**   | `Luenio · Leads`                                | `Luenio · Agencia`                                              |
| **HTML**     | `apps/admin/admin.html`                         | `apps/admin/crm.html`                                           |
| **JS**       | `apps/admin/src/admin.js`                       | `apps/admin/crm/{bootstrap,app}.js` + `components/*`            |
| **DB**       | Supabase (schema `supabase/schema.sql`)         | Neon Postgres (`db/migrations/001_crm_agency_schema.sql`)       |
| **API**      | `/api/leads`, auth SaaS, etc.                   | `/api/crm/*`                                                    |
| **Auth UI**  | Sesión admin obligatoria                        | En **dev**: abierto; en **prod**: login salvo `CRM_PUBLIC=true` |
| **Datos**    | Leads del producto                              | clients / leads pipeline / projects / invoices / users (Neon)   |

## Rutas UI Agency (`/crm`)

| Hash              | Vista                                      | Fuente API                                                        |
| ----------------- | ------------------------------------------ | ----------------------------------------------------------------- |
| `#/dashboard`     | Command center (KPIs, top deals, cobranza) | `GET /api/crm/dashboard`                                          |
| `#/pipeline`      | Kanban deals                               | `GET /api/crm/pipeline` + `POST /api/crm/leads` + `PATCH …/stage` |
| `#/clientes`      | Tabla clientes                             | `GET /api/crm/clients`                                            |
| `#/proyectos`     | Timeline proyectos                         | `GET /api/crm/projects`                                           |
| `#/facturacion`   | Facturas                                   | `GET /api/crm/invoices`                                           |
| `#/configuracion` | Equipo                                     | `GET /api/crm/users`                                              |

## API Agency (`/api/crm/*`)

Auth: en producción se exige sesión (`getSessionUser`) salvo `CRM_PUBLIC=true` o `CRM_API_PUBLIC=true`. En desarrollo la API está abierta para QA.  
`GET /health` siempre abierto (probes).  
`GET /debug/error` solo en dev o `CRM_DEBUG_ENDPOINTS=true`.

| Method | Path                       | Body / query                                                            | Respuesta                                     |
| ------ | -------------------------- | ----------------------------------------------------------------------- | --------------------------------------------- |
| GET    | `/api/crm/health`          | —                                                                       | `{ ok: boolean }`                             |
| GET    | `/api/crm/me`              | —                                                                       | `{ data: { email, name, role, publicMode } }` |
| GET    | `/api/crm/dashboard`       | —                                                                       | métricas + topDeals + invoicesAtRisk          |
| GET    | `/api/crm/pipeline`        | —                                                                       | `{ data: boardByStage, summary }`             |
| POST   | `/api/crm/leads`           | `{ name, stage?, value?, probability?, client_id?, owner_id?, notes? }` | `201 { data: lead }`                          |
| GET    | `/api/crm/leads/:id`       | —                                                                       | lead                                          |
| PATCH  | `/api/crm/leads/:id/stage` | `{ stage, position }`                                                   | lead actualizado                              |
| GET    | `/api/crm/clients`         | `?q=&page=&limit=&status=`                                              | `{ data, total, page, limit }`                |
| GET    | `/api/crm/projects`        | `?status=`                                                              | `{ data }`                                    |
| GET    | `/api/crm/invoices`        | `?status=&page=&limit=`                                                 | `{ data, totals }`                            |
| GET    | `/api/crm/users`           | —                                                                       | equipo Neon                                   |
| GET    | `/api/crm/debug/error`     | —                                                                       | probe Sentry (dev)                            |

## Flujos clave

### Nuevo deal (Pipeline)

1. Usuario en `#/pipeline` → botón **Nuevo deal**.
2. Modal valida `name` (obligatorio).
3. `POST /api/crm/leads` → Neon `leads` (position al tope de la columna).
4. Board se recarga; toast éxito.

### Mover etapa (DnD)

1. Drag card → drop en columna (índice visual = `position`).
2. `PATCH /api/crm/leads/:id/stage` con `{ stage, position }`.
3. Reload board + toast.

### Focus lead desde Inicio

1. En command center, click en un top deal.
2. `sessionStorage.setItem('crm:focusLead', id)`.
3. Navigate `#/pipeline`.
4. `loadPipeline` lee y **borra** la key; `renderKanbanBoard({ focusLeadId })` resalta y hace scroll.

## Variables de entorno

| Variable                             | Uso                                                     |
| ------------------------------------ | ------------------------------------------------------- |
| `DATABASE_URL` / `NEON_DATABASE_URL` | Neon (obligatoria para agency)                          |
| `CRM_PUBLIC`                         | UI `/crm` sin login en prod si `true`                   |
| `CRM_API_PUBLIC`                     | API `/api/crm/*` abierta en prod si `true` (solo demos) |
| `CRM_DEBUG_ENDPOINTS`                | Habilita `debug/error` en prod                          |
| `SENTRY_DSN` / `SENTRY_DSN_PUBLIC`   | Observabilidad                                          |
| Supabase vars                        | Solo `/dashboard` y auth SaaS                           |

## Qué no unificar (este pase)

- No migrar leads de Supabase a Neon ni al revés.
- No reescribir a React.
- No inventar CRUD completo de clientes/facturas en UI (empty states honestos).
- No mock arrays en la UI final.

## Docs relacionadas

- [DEPLOY-CRM.md](./DEPLOY-CRM.md) — deploy Docker / tunnel
- [neon-setup.md](./neon-setup.md) — proyecto Neon, migrate, seed
- [schema.md](./schema.md) — tablas agency
- [CRM.md](./CRM.md) — guía panel leads (`/dashboard`)

## Smoke local

```bash
npm run dev          # otro terminal
npm run test:crm-api
```
