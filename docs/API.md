# Luenio API (contrato interno)

Auth de sesión: cookie HttpOnly de login (`POST /api/auth`). Las mutaciones de browser exigen same-site / Fetch Metadata.

## Rutas

| Método   | Ruta                      | Auth                                                 | Notas                                                    |
| -------- | ------------------------- | ---------------------------------------------------- | -------------------------------------------------------- |
| GET      | `/api/health`             | público liveness; `?details=1` + Bearer health token |                                                          |
| GET      | `/api/public-config`      | no                                                   | Turnstile site key, flags públicos                       |
| POST     | `/api/contact`            | no                                                   | Turnstile + honeypot; respuesta solo `{ ok, inquiryId }` |
| GET/POST | `/api/auth`               | sesión / login                                       | MFA admin en prod                                        |
| GET/POST | `/api/invitations`        | admin                                                |                                                          |
| POST     | `/api/invitations/accept` | no                                                   | token de invitación                                      |
| POST     | `/api/invitations/revoke` | admin                                                |                                                          |
| POST     | `/api/password-reset/*`   | no                                                   |                                                          |
| GET      | `/api/leads`              | sesión                                               | workspace CRM                                            |
| POST     | `/api/leads`              | sesión                                               | captura lead CRM                                         |
| POST     | `/api/process`            | sesión                                               | procesar lead o actualizar                               |
| GET      | `/api/billing`            | sesión                                               | overview; checkout off en v1                             |
| GET      | `/api/settings`           | sesión                                               |                                                          |
| POST     | `/api/stripe-webhook`     | Stripe signature                                     | fail-closed si billing off                               |

## `POST /api/process` bodies

### Crear / procesar lead

Campos lead estándar: `name`, `business`, `phone`, `service`, `message`, `source`.

### Actualizar pipeline

```json
{ "leadId": "lead_...", "status": "contacted", "pipelineStage": "contacted" }
```

### Notas y tags

```json
{ "leadId": "lead_...", "notes": "...", "tags": ["urgente", "whatsapp"] }
```

### Próxima acción

```json
{ "leadId": "lead_...", "nextAction": "Llamar", "nextActionAt": "2026-07-22T15:00:00.000Z" }
```

### Registrar contacto

```json
{
  "leadId": "lead_...",
  "logContact": { "type": "whatsapp", "summary": "Respondió; pide propuesta" }
}
```

Tipos: `whatsapp` | `call` | `email` | `note` | `other`.

### Digest preview

```json
{ "mode": "digest" }
```

Respuesta: `{ ok, mode: "digest", digest: { totals, dueToday, staleHot, noContact } }`.

### Digest worker (servidor → n8n)

Con `DIGEST_CRON_ENABLED=true`, el proceso envía periódicamente a `DIGEST_WEBHOOK_URL`:

```json
{
  "type": "luenio.crm.daily_digest",
  "workspaceId": "biz_…",
  "recipient": null,
  "digest": {},
  "summary": { "dueToday": 0, "staleHot": 0, "noContact": 0, "leads": 0 }
}
```

Header: `Authorization: Bearer <DIGEST_WEBHOOK_TOKEN>`.

### Listar leads (búsqueda / página)

`GET /api/leads?q=texto&limit=50&cursor=lead_id`

Respuesta incluye `pagination: { total, limit, cursor, nextCursor, q }`.

### Asignar lead

```json
{ "leadId": "lead_…", "assigneeUserId": "usr_…" }
```

`assigneeUserId: null` o `""` quita la asignación.

### Bulk update

```json
{
  "mode": "bulk",
  "leadIds": ["lead_…"],
  "status": "qualified",
  "addTags": ["urgente"],
  "assigneeUserId": "usr_…"
}
```

Máx. 50 ids. Respuesta: `{ mode: "bulk_update", updated, failed, results }`.

### Import CSV rows

`POST /api/leads`

```json
{
  "mode": "import",
  "rows": [
    {
      "name": "Ana",
      "business": "Nova",
      "phone": "+57…",
      "service": "CRM",
      "source": "import_csv",
      "message": "",
      "tags": "urgente"
    }
  ]
}
```

Máx. 100 filas. Respuesta: `{ mode: "import", imported, failed, results }`.

## Errores

- `400` validación / stage inválido / summary vacío
- `401` sin sesión
- `404` lead fuera del workspace
- `409` duplicado reciente
- `429` rate limit
- `503` dependencias / billing deshabilitado
