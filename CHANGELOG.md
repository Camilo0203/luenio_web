# Changelog

## 2026.8.1 - Release candidate

### Lanzamiento

- Sitio público, cotización, siete landings y siete simulaciones unificados para producción.
- CRM, autenticación, invitaciones, recuperación y MFA endurecidos para el alcance P0/P1.
- Gate de producción determinista con 31/31 controles, regresión visual y presupuestos de rendimiento.
- Imagen prevista como `luenio-app:2026.08.1` y release Sentry `luenio@2026.08.1`.

### Bloqueos externos

- La promoción pública requiere identidad legal revisada y `LEGAL_IDENTITY_READY=true`.
- Staging debe validar Supabase, n8n, Resend, Turnstile, GA4, Sentry, R2 y Better Stack reales.

## 0.1.0

### Producto

- Sitio público lead-gen (home, cotización, legales, nichos demo)
- CRM privado por invitación: pipeline, scoring por reglas, demo en vivo
- Notas, tags, búsqueda, export CSV
- Próxima acción, contact log, cola de hoy, filtros smart
- Plantillas WhatsApp, onboarding de 4 pasos, preview de digest diario
- Worker de digest programable (`DIGEST_CRON_*`) + badge “Vencidos / hoy”
- Bulk etapa/tags, import/export CSV, búsqueda API `q=`, plantillas email
- Reportes CRM: embudo por etapa + fuentes (7/30 días)
- Docs de roadmap, arquitectura, runbook y guía CRM

### Plataforma

- API Node fail-closed en producción
- Frontera `db/storage.js` (Supabase / JSON dev)
- Core modular: scoring, pipeline, lead-engine
- n8n workflows de contacto, acceso y MFA (+ stub digest)
- Docker, Caddy, scripts ops, schema Supabase + migración lead ops

### Calidad

- Production gate de tests (`npm test`)
- CI GitHub Actions (lint, format, test)
- README, docs de API, checklist producción, security/deployment
- Logger estructurado en contact/process

### Notas

- Billing público desactivado (`ENABLE_PUBLIC_BILLING=false`)
- Scoring no es LLM
- `LEGAL_IDENTITY_READY` requiere revisión humana antes de prod
