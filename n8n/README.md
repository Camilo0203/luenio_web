# n8n de Luenio

## Workflows

- `contact-inquiry-email.json`: notifica un lead ya persistido.
- `access-email.json`: envía invitaciones y enlaces de recuperación.
- `admin-mfa-email.json`: envía códigos MFA administrativos de diez minutos.
- `daily-digest-email.json`: digest diario (worker de la app con `DIGEST_CRON_*` o preview `POST /api/process` `{ "mode": "digest" }`).

### Digest automático

La app, con `DIGEST_CRON_ENABLED=true`, hace `POST` al webhook con body:

```json
{
  "type": "luenio.crm.daily_digest",
  "workspaceId": "biz_…",
  "recipient": "opcional@correo.com",
  "digest": { "totals": {}, "dueToday": [], "staleHot": [], "noContact": [] },
  "summary": { "dueToday": 0, "staleHot": 0, "noContact": 0, "leads": 0 }
}
```

## Instalación

1. Crea instancias y volúmenes independientes para staging y producción.
2. Configura `N8N_ENCRYPTION_KEY`, `N8N_HOST` y los webhooks/tokens en `/etc/luenio/<entorno>.env`; nunca reutilices valores.
3. Protege `automation.luenio.com` y `automation-staging.luenio.com` con Cloudflare Access + MFA.
4. Importa los workflows en cada instancia.
5. Crea una credencial Header Auth por workflow. Cada una usa header `Authorization` y valor `Bearer <TOKEN_CORRESPONDIENTE>`.
6. Crea credenciales Resend SMTP separadas, con dominio verificado, SPF, DKIM y DMARC.
7. Activa y prueba cada flujo primero en staging.

URLs esperadas:

```text
https://automation.luenio.com/webhook/luenio-contact
https://automation.luenio.com/webhook/luenio-invitation
https://automation.luenio.com/webhook/luenio-admin-mfa
```

En staging reemplaza el host por `automation-staging.luenio.com`.

El contacto se guarda en Supabase antes de invocar n8n. Los workflows no conservan payloads de éxito o error para evitar copias innecesarias de PII, enlaces y códigos.

## Seguridad

- No habilites community packages.
- No permitas acceso al editor sin Cloudflare Access.
- Los paths `/webhook/*` no usan Basic Auth del editor, pero sí Header Auth independiente.
- Nunca reutilices tokens entre workflows.
- Conserva `N8N_ENCRYPTION_KEY` fuera del VPS; sin ella no pueden restaurarse las credenciales.
- Revisa cambios de workflow y credenciales desde una cuenta con MFA.

## Aprobaciones: pendiente a propósito

Los cuatro nodos `02p`–`02s` (comando `/luna aprobar|rechazar …` como nota
privada) están montados y probados, pero **siguen fuera de producción**. La
razón no es técnica: aprobar solo marca la fila en `luenio_proposal_requests` y
te confirma por Chatwoot. No envía nada, porque quien genera la propuesta es
`Generar propuesta PDF`, que está inactivo.

Entran el día que exista ese render. Viven en
`Luenio Chatbot [WIP aprobaciones + multimedia]`, respaldado en
`n8n/instance/`; cuelgan de la salida **falsa** de `02 Filtro | Validar mensaje
entrante`, que hoy no va a ninguna parte, así que la promoción es aditiva.

El aprobador ya acepta el estado `requested` además de `pending_approval`:
`requested` es el único que la topología activa alcanza hoy, y sin renderizador
ES el estado que espera a un humano.

## Probar el chatbot antes de tocar producción

El cerebro de LUNA vive en tres sub-workflows (`Interpretar mensaje`,
`Consultar KB`, `Decidir turno`) que orquesta `Orquestar turno v3`. El chatbot
de producción lo llama desde su nodo `14c`, y lo que sale de ahí es literalmente
lo que el nodo `16` manda al cliente por WhatsApp. Se puede conversar con ese
mismo cerebro sin mandar un solo mensaje real:

```bash
N8N_URL=https://n8n.ejemplo.com node n8n/conversar.mjs
```

Trece guiones, cada uno sacado de una forma real de escribir por WhatsApp. El
script marca `⚠️ RESPUESTA REPETIDA` cuando el bot contesta dos veces lo mismo,
que es el fallo que más rápido pierde a un cliente. No toda repetición es un
defecto: dos mensajes ininteligibles seguidos merecen la misma orientación.

Antes hay que activar `ZZ TEMP | Banco de conversación LUNA`, y **apagarlo al
terminar**: su webhook no pide autenticación.

Dos cosas que muerden:

- n8n guarda en memoria la definición de un workflow activo. Un `PUT` solo no
  surte efecto: hay que desactivar y volver a activar.
- Aun reactivando, la primera ejecución puede atender con la definición vieja.
  Manda un mensaje de calentamiento antes de fiarte de lo que leas.

## Backup

El backup de producción es cifrado y offsite:

```bash
BACKUP_AGE_RECIPIENT=age1... RCLONE_REMOTE=luenio-r2:production ops/backup-volumes.sh
```

Ensaya trimestralmente una restauración en un volumen vacío con `ops/restore-volumes.sh`. Consulta `SECURITY.md` para el procedimiento completo.
