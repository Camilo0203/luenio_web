# Guía CRM Luenio (panel `/dashboard`)

Acceso solo por **invitación**. No hay registro público.

## Primeros pasos (onboarding)

1. **Ejecutar Demo en Vivo** — ve scoring y pipeline sin tocar datos reales.
2. **Mover un lead de etapa** — botones de filtro + “Mover etapa” en el detalle.
3. **Guardar notas o etiquetas** — en el panel de detalle.
4. **Exportar CSV** — toolbar del pipeline.

El banner se puede ocultar 30 días.

## Cola de hoy

Prioriza automáticamente:

1. Próxima acción vencida
2. Calientes sin contacto (&gt; 48 h o nunca)
3. Sin contacto
4. Con next action pendiente

Clic en un ítem abre el detalle.

## Filtros

- **Score:** todos / caliente / tibio / frío
- **Etapa:** new → converted
- **Smart:** mis leads, sin asignar, vencen hoy, calientes sin tocar, sin contacto, seguimiento
- **Búsqueda:** nombre, negocio, teléfono, tags, notas

## Asignación

- Detalle del lead → **Asignar lead** (yo / miembro / sin asignar)
- Bulk → **Asignar a…**
- Filtro **Mis leads** = asignados a la sesión actual

## Detalle del lead

| Acción                 | Uso                                 |
| ---------------------- | ----------------------------------- |
| Notas                  | Contexto interno (no va al cliente) |
| Etiquetas              | p.ej. `urgente`, `whatsapp`         |
| Próxima acción + fecha | Qué hacer y cuándo                  |
| Asignar lead           | Responsable del workspace           |
| Registrar contacto     | WhatsApp / llamada / email / nota   |
| Plantilla WhatsApp     | Copiar o abrir `wa.me`              |
| Por qué este score     | Razones del motor de reglas         |
| Mover etapa            | Avanza el pipeline                  |

## Invitaciones (solo admin)

- 72 horas, un solo uso
- El enlace completo se muestra **una vez**
- Roles: `client` o `admin`

## Digest y recordatorios

- **Métrica “Vencidos / hoy”** en el resumen superior (se resalta si hay pendientes o calientes sin tocar).
- Botón **Vista previa digest** en estado del sistema: arma el resumen sin enviarlo.
- Envío automático (opcional):
  1. Importar `n8n/workflows/daily-digest-email.json`
  2. `DIGEST_CRON_ENABLED=true`
  3. `DIGEST_WEBHOOK_URL` HTTPS + `DIGEST_WEBHOOK_TOKEN` (≥32)
  4. Opcional: `DIGEST_RECIPIENT`, `DIGEST_MIN_HOURS_BETWEEN=20`, `DIGEST_ONLY_IF_ACTIONABLE=true`

El worker del servidor revisa workspaces periódicamente y solo envía si hay acciones vencidas o calientes sin tocar (salvo que desactives el filtro).

## Demo vs producción

La demo **no** escribe en el CRM real ni en `localStorage` de clientes.  
Los leads de demo tienen id `demo_lead_*`.

## Bulk e importación

1. Marca checkboxes en el pipeline o en la tabla (no aplica a demos).
2. Barra **Aplicar**: mover etapa y/o añadir un tag a todos los seleccionados (máx. 50).
3. **Exportar CSV** usa el filtro actual (incl. búsqueda).
4. **Importar CSV** (máx. 100 filas). Encabezados: `nombre,negocio,telefono,servicio[,fuente,mensaje,tags]`.

## Plantillas email

En el detalle del lead: copiar asunto+cuerpo o abrir `mailto:`.

## Reportes

Panel **Embudo y fuentes** (debajo de la cola de hoy):

- Ventana **7 días** o **30 días**
- Resumen: leads en ventana, histórico, calientes, sin tocar, vencen hoy, sin contacto
- Barras **por fuente** y **embudo por etapa** (excluye demos)

## Buenas prácticas

- Todo lead hot: next action en &lt; 24 h
- Registrar cada toque en contact log
- Exportar semanalmente como respaldo operativo
