# Neon setup — Luenio Agency CRM

## Por qué Neon

El CRM premium (dashboard, clients, pipeline, projects, invoices, metrics) usa **Neon Serverless Postgres** vía `DATABASE_URL` y `@neondatabase/serverless`.  
Supabase sigue alimentando auth + leads del producto operativo existente.

## Pasos (una vez)

```bash
# 1. Login OAuth (abre el navegador — completar en < 60s)
npm run db:neon:auth

# 2. Crear proyecto
npm run db:neon:create

# 3. Obtener connection string (reemplaza PROJECT_ID)
npx neonctl@latest connection-string --project-id PROJECT_ID

# 4. Añadir a .env
# DATABASE_URL=postgresql://...@ep-....neon.tech/neondb?sslmode=require

# 5. Migrar + seed
npm run db:migrate
npm run db:seed
```

## Verificar sin Neon (solo SQL)

```bash
npm run db:verify
```

Esto aplica migración + seed en PGlite y confirma conteos (users/clients/leads/…).  
**No sustituye** el proyecto cloud de Neon en producción.

## API

| Método | Ruta                       | Descripción           |
| ------ | -------------------------- | --------------------- |
| GET    | `/api/crm/health`          | Ping DB               |
| GET    | `/api/crm/dashboard`       | MRR + pipeline + KPIs |
| GET    | `/api/crm/clients`         | Tabla clientes        |
| GET    | `/api/crm/pipeline`        | Kanban board          |
| PATCH  | `/api/crm/leads/:id/stage` | Mover tarjeta         |
| GET    | `/api/crm/projects`        | Proyectos             |
| GET    | `/api/crm/invoices`        | Facturas              |
| GET    | `/api/crm/users`           | Equipo                |

## Archivos

- Migración: `db/migrations/001_crm_agency_schema.sql`
- Seed: `db/seeds/001_crm_seed.sql`
- Schema doc: `docs/schema.md`
- Client: `lib/db/client.js`
- Queries: `lib/db/queries.js`
