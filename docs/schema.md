# Schema — Luenio Agency CRM (Neon Postgres)

**Migración:** `db/migrations/001_crm_agency_schema.sql`  
**Seed:** `db/seeds/001_crm_seed.sql`  
**Cliente:** `lib/db/client.js` (`@neondatabase/serverless`)  
**Queries:** `lib/db/queries.js`

---

## Diagrama ER

```
users 1──┬──* clients
         ├──* leads
         └──* projects

clients 1──┬──* leads
           ├──* projects
           └──* invoices

projects 1──* invoices (nullable)

metrics_snapshots  (standalone time series)
```

---

## Enums

| Tipo             | Valores                                                                |
| ---------------- | ---------------------------------------------------------------------- |
| `lead_stage`     | `nuevo`, `contactado`, `propuesta`, `negociacion`, `ganado`, `perdido` |
| `project_status` | `activo`, `pausado`, `completado`                                      |
| `invoice_status` | `borrador`, `enviada`, `pagada`, `vencida`                             |
| `client_status`  | `activo`, `prospecto`, `inactivo`, `churned`                           |
| `user_role`      | `owner`, `admin`, `agent`, `viewer`                                    |

---

## Tablas

### `users`

| Columna                 | Tipo                 | Notas               |
| ----------------------- | -------------------- | ------------------- |
| id                      | uuid PK              | `gen_random_uuid()` |
| name                    | text NOT NULL        |                     |
| email                   | text UNIQUE NOT NULL |                     |
| role                    | user_role            | default `agent`     |
| avatar_url              | text                 | nullable            |
| created_at / updated_at | timestamptz          | trigger on update   |

### `clients`

| Columna                 | Tipo            | Notas              |
| ----------------------- | --------------- | ------------------ |
| id                      | uuid PK         |                    |
| name                    | text            | contacto principal |
| company                 | text            | empresa            |
| email                   | text            |                    |
| phone                   | text            |                    |
| status                  | client_status   |                    |
| avatar_url              | text            |                    |
| tags                    | text[]          | GIN index          |
| owner_id                | uuid FK → users | ON DELETE SET NULL |
| created_at / updated_at | timestamptz     |                    |

### `leads` (pipeline / kanban)

| Columna                 | Tipo              | Notas              |
| ----------------------- | ----------------- | ------------------ |
| id                      | uuid PK           |                    |
| name                    | text              | nombre oportunidad |
| client_id               | uuid FK → clients | nullable           |
| stage                   | lead_stage        | default `nuevo`    |
| value                   | numeric(14,2)     | monto deal         |
| probability             | int 0–100         |                    |
| expected_close_date     | date              |                    |
| position                | double precision  | orden en columna   |
| owner_id                | uuid FK → users   |                    |
| notes                   | text              |                    |
| created_at / updated_at | timestamptz       |                    |

**Índices clave:** `(stage, position)`, `expected_close_date`

### `projects`

| Columna                 | Tipo              | Notas             |
| ----------------------- | ----------------- | ----------------- |
| id                      | uuid PK           |                   |
| client_id               | uuid FK → clients | ON DELETE CASCADE |
| name                    | text              |                   |
| status                  | project_status    |                   |
| start_date / end_date   | date              |                   |
| budget                  | numeric(14,2)     |                   |
| progress_percent        | int 0–100         |                   |
| owner_id                | uuid FK → users   |                   |
| created_at / updated_at | timestamptz       |                   |

### `invoices`

| Columna                 | Tipo               | Notas            |
| ----------------------- | ------------------ | ---------------- |
| id                      | uuid PK            |                  |
| client_id               | uuid FK → clients  | RESTRICT         |
| project_id              | uuid FK → projects | SET NULL         |
| number                  | text UNIQUE        | ej. INV-2026-001 |
| amount                  | numeric(14,2) ≥ 0  |                  |
| currency                | char(3)            | default USD      |
| status                  | invoice_status     |                  |
| issue_date / due_date   | date               |                  |
| paid_at                 | timestamptz        |                  |
| created_at / updated_at | timestamptz        |                  |

### `metrics_snapshots`

| Columna              | Tipo        | Notas              |
| -------------------- | ----------- | ------------------ |
| id                   | uuid PK     |                    |
| month                | date UNIQUE | primer día del mes |
| mrr                  | numeric     |                    |
| new_mrr              | numeric     |                    |
| churned_mrr          | numeric     |                    |
| active_clients_count | int         |                    |
| created_at           | timestamptz |                    |

---

## Relaciones (FK)

| From                | To          | On delete |
| ------------------- | ----------- | --------- |
| clients.owner_id    | users.id    | SET NULL  |
| leads.client_id     | clients.id  | SET NULL  |
| leads.owner_id      | users.id    | SET NULL  |
| projects.client_id  | clients.id  | CASCADE   |
| projects.owner_id   | users.id    | SET NULL  |
| invoices.client_id  | clients.id  | RESTRICT  |
| invoices.project_id | projects.id | SET NULL  |

---

## Seed de ejemplo

Datos realistas de agencia (Nova Studio, LegalHub, Andes Coffee, Finora, Helix, etc.):

- 4 users (owner + admin + 2 agents)
- 10 clients con tags y estados mixtos
- 12 leads en todas las etapas del pipeline
- 6 projects con progreso y presupuestos
- 10 invoices (pagada / enviada / vencida / borrador)
- 6 months de `metrics_snapshots` (MRR creciente ~18k → 31k)

---

## Aplicar migración

```bash
# Con DATABASE_URL en el entorno:
npm run db:migrate
npm run db:seed
```

O manualmente:

```bash
psql "$DATABASE_URL" -f db/migrations/001_crm_agency_schema.sql
psql "$DATABASE_URL" -f db/seeds/001_crm_seed.sql
```

---

## Nota de coexistencia con Supabase

El monorepo Luenio ya usa **Supabase** para auth/leads operativos del producto actual (`supabase/schema.sql`).  
Este schema de **Agency CRM** vive en **Neon** como data plane del módulo premium (dashboard, clients, pipeline, projects, invoices, metrics).  
No se mezclan tablas en el mismo namespace sin migración explícita; las vistas del CRM premium leen solo vía `lib/db/*` + `DATABASE_URL`.
