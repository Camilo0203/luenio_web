# Roadmap Luenio

Tres estados secuenciales. No saltes a P2 sin tracción.

## P0 — Publicable (ahora)

Meta: lead real → Supabase → n8n → admin con MFA.

| Área                            | Estado                                        |
| ------------------------------- | --------------------------------------------- |
| Código lead-gen + CRM base      | Hecho en repo                                 |
| Supabase staging/prod           | **Pendiente (ops)**                           |
| n8n + SMTP + Turnstile          | **Pendiente (ops)**                           |
| Cloudflare + firewall + backups | **Pendiente (ops)**                           |
| `LEGAL_IDENTITY_READY=true`     | **Pendiente (legal)**                         |
| Gate `npm test` + preflight     | Hecho en código; ejecutar con secretos reales |

Checklist humano: [CHECKLIST-PRODUCCION.md](./CHECKLIST-PRODUCCION.md).

## P1 — CRM de trabajo diario

| Ítem                                                      | Estado                                 |
| --------------------------------------------------------- | -------------------------------------- |
| Notas, tags, CSV, next action, contact log, cola, filtros | Hecho                                  |
| Digest preview en UI                                      | Hecho                                  |
| Digest/recordatorios programados (worker + n8n)           | Hecho en código                        |
| Badge “Vencidos / hoy”                                    | Hecho                                  |
| Asignación a usuarios (assignee + mis leads)              | Hecho                                  |
| Bulk etapa/tags + import/export CSV + search API          | Hecho                                  |
| Reportes (fuente / embudo / 7–30d)                        | Hecho                                  |
| Modularizar `admin.js`                                    | Hecho (state / lead-model / live-demo) |
| E2E browser (Playwright) + a11y CI                        | Hecho                                  |

## P2 — Escala (condicional)

Elegir **una** apuesta:

1. Stripe self-serve, o
2. Multi-workspace agency UI, o
3. IA real (sugerencias, no auto-escritura)

No las tres a la vez.

El prototipo de multi-workspace/Agency CRM ya existe en el repositorio, pero permanece congelado
con `ENABLE_AGENCY_CRM=false` hasta cumplir las métricas siguientes. No forma parte del build ni
del readiness del lanzamiento lead-gen.

## Métricas para abrir P2

En 4 semanas de producción:

- Cotizaciones semanales sostenidas
- ≥ 50% leads con next action o contact log
- Primera respuesta &lt; 4 h
- 0 incidentes de seguridad abiertos

## Fuera de alcance (por ahora)

- Reescritura Next/React
- Microservicios
- Activar billing “por probar”
- LLM en el navegador
