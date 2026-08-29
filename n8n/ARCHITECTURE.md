# Arquitectura de la instancia de n8n

Generado por `scripts/n8n-sync.mjs` desde la instancia real. No editar a mano:
se sobrescribe en cada sincronización.

Workflows: **29** — 18 de producción, 11 de staging, 0 de laboratorio.

## Camino de un mensaje

```text
WhatsApp (Meta)
      |
  Chatwoot            chat.ton618bot.xyz
      |  POST webhook
  Luenio Chatbot      90 nodos: seguridad, deduplicación, estado
      |
  LUNA | Orquestar turno v3
      |-- Interpretar mensaje      JavaScript determinista, sin LLM
      |-- Consultar KB y objeciones
      +-- Decidir turno            JavaScript determinista, sin LLM
      |
  Google Sheets       documento «Luenio Chatbot»
```

El cerebro **no usa un modelo de lenguaje**: `Interpretar mensaje` y `Decidir turno`
son código determinista sin llamadas externas. OpenRouter solo aparece en
`Luenio Chatbot [STAGING AUTO]`, la arquitectura anterior.

## CRM en Google Sheets

### Pestaña `Hoja 1` — 61 columnas

`conversation_id`, `phone`, `history`, `name`, `waiting_for_name`, `business_type`, `interested_service`, `lead_status`, `notes`, `last_message`, `last_ai_response`, `updated_at`, `next_action`, `appointment_date`, `budget`, `human_required`, `email`, `project_goal`, `selected_solution`, `pipeline_stage`, `last_intent`, `missing_fields`, `lead_score`, `conversation_summary`, `followup_at`, `followup_status`, `followup_count`, `last_bot_at`, `bot_muted`, `followup_2h_at`, `followup_2h_status`, `followup_2h_count`, `opt_out`, `handoff_at`, `urgency`, `decision_role`, `budget_signal`, `ficha_confirmada`, `site_shared`, `proposal_sent`, `proposal_accepted`, `pain_point`, `current_process`, `impact`, `desired_outcome`, `discovery_urgency`, `discovery_depth`, `discovery_done`, `recommended_solution`, `solution_confirmed`, `price_requested`, `proposal_requested`, `proposal_delivery_status`, `objection_code`, `handoff_reason`, `appointment_status`, `appointment_timezone`, `appointment_event_id`, `appointment_confirmation_sent`, `schema_version`, `row_number`

### Pestaña `Insights LUNA` — 26 columnas

`date`, `schema_version`, `unique_conversations`, `inbound_messages`, `processed_messages`, `duplicate_messages`, `blocked_messages`, `discovery_completed`, `solutions_confirmed`, `price_requests`, `proposal_requests`, `proposals_sent`, `proposals_accepted`, `handoffs`, `opt_outs`, `followups_dry_run`, `followups_sent`, `followups_failed`, `critical_errors`, `secondary_errors`, `avg_turns_to_discovery`, `avg_minutes_to_proposal`, `catalog_unavailable_count`, `generated_at`, `source_version`, `status`

> 1 nodo(s) referencian su pestaña **por nombre**; el resto usa el
> identificador, que sobrevive a un renombrado. Estos no:
> - Luenio Catalogo Sync [STAGING] / 02 Sheets | Leer catalogo_luna -> `catalogo_luna`

> El nombre en caché que guarda n8n puede estar desfasado respecto al nombre real
> de la pestaña; no es un fallo mientras la referencia sea por identificador.

## Huecos detectados

- **Luenio LUNA | Generar propuesta PDF** — sub-workflow que **nadie invoca**
- **Luenio LUNA | Gestionar agenda** — sub-workflow que **nadie invoca**
- **Luenio LUNA | Gestionar aprobaciones** — solo lo invocan workflows **apagados** (Luenio Chatbot [WIP aprobaciones + multimedia]): no se ejecuta
- **Luenio LUNA | Persistir CRM** — solo lo invocan workflows **apagados** (Luenio LUNA | Orquestar turno v3 [STAGING]): no se ejecuta

## Producción

| Workflow | Estado | Disparador | Invocado por |
| --- | --- | --- | --- |
| Luenio Chatbot | activo | webhook | — |
| Luenio Chatbot [WIP aprobaciones + multimedia] | inactivo | webhook | — |
| Luenio Error Log | activo | errorTrigger | Luenio Chatbot, Luenio Chatbot [STAGING AUTO] (apagado), Luenio Chatbot [STAGING PROFESSIONAL] (apagado), Luenio Chatbot [WIP aprobaciones + multimedia] (apagado), Luenio Followup 2h+24h, Luenio LUNA | Vigilar SLA handoff |
| Luenio Followup 2h+24h | activo | scheduleTrigger | — |
| Luenio Insights | Consolidar diario | activo | manualTrigger | — |
| Luenio Insights | Registrar evento | activo | executeWorkflowTrigger | Luenio Chatbot, Luenio Chatbot [STAGING AUTO] (apagado), Luenio Chatbot [STAGING PROFESSIONAL] (apagado), Luenio Chatbot [WIP aprobaciones + multimedia] (apagado), Luenio Followup 2h+24h |
| Luenio LUNA | Consultar KB y objeciones | activo | executeWorkflowTrigger | Luenio LUNA | Orquestar turno v3, Luenio LUNA | Orquestar turno v3 [STAGING] (apagado) |
| Luenio LUNA | Decidir turno | activo | executeWorkflowTrigger | Luenio LUNA | Orquestar turno v3, Luenio LUNA | Orquestar turno v3 [STAGING] (apagado) |
| Luenio LUNA | Generar propuesta PDF | inactivo | executeWorkflowTrigger | — |
| Luenio LUNA | Gestionar agenda | inactivo | executeWorkflowTrigger | — |
| Luenio LUNA | Gestionar aprobaciones | activo | executeWorkflowTrigger | Luenio Chatbot [WIP aprobaciones + multimedia] (apagado) |
| Luenio LUNA | Interpretar mensaje | activo | executeWorkflowTrigger | Luenio LUNA | Orquestar turno v3, Luenio LUNA | Orquestar turno v3 [STAGING] (apagado) |
| Luenio LUNA | Orquestar turno v3 | activo | executeWorkflowTrigger | Luenio Chatbot, Luenio Chatbot [STAGING PROFESSIONAL] (apagado), Luenio Chatbot [WIP aprobaciones + multimedia] (apagado), ZZ TEMP | Banco de conversación LUNA (borrar) (apagado) |
| Luenio LUNA | Persistir CRM | activo | executeWorkflowTrigger | Luenio LUNA | Orquestar turno v3 [STAGING] (apagado) |
| Luenio LUNA | Procesar multimedia | activo | executeWorkflowTrigger | Luenio Chatbot, Luenio Chatbot [WIP aprobaciones + multimedia] (apagado) |
| Luenio LUNA | Registrar acción operativa | activo | executeWorkflowTrigger | Luenio Chatbot, Luenio Chatbot [STAGING PROFESSIONAL] (apagado), Luenio Chatbot [WIP aprobaciones + multimedia] (apagado), Luenio LUNA | Orquestar turno v3 [STAGING] (apagado) |
| Luenio LUNA | Vigilar SLA handoff | activo | scheduleTrigger | — |
| ZZ TEMP | Banco de conversación LUNA (borrar) | inactivo | webhook | — |

## Staging

| Workflow | Estado | Disparador | Invocado por |
| --- | --- | --- | --- |
| Luenio Advanced Waves [STAGING] | inactivo | manualTrigger | — |
| Luenio Catalog Context [STAGING] | inactivo | manualTrigger | — |
| Luenio Catalogo Sync [STAGING] | inactivo | manualTrigger | — |
| Luenio Chatbot [STAGING AUTO] | inactivo | webhook | — |
| Luenio Chatbot [STAGING PROFESSIONAL] | inactivo | webhook | — |
| Luenio Evaluations [STAGING] | inactivo | manualTrigger | — |
| Luenio Evaluations v3 [STAGING] | inactivo | manualTrigger | — |
| Luenio Insights | Consolidar diario v3 [STAGING] | inactivo | manualTrigger | — |
| Luenio Insights | Registrar evento v3 [STAGING] | inactivo | executeWorkflowTrigger | — |
| Luenio LUNA | Decidir turno [STAGING v3.0.3] | inactivo | executeWorkflowTrigger | — |
| Luenio LUNA | Orquestar turno v3 [STAGING] | inactivo | webhook | — |

## Laboratorio y pruebas

| Workflow | Estado | Disparador | Invocado por |
| --- | --- | --- | --- |

