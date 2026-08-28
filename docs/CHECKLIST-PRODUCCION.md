# Checklist bloqueante de producción

Completa cada ítem en staging antes de promover exactamente la misma imagen a producción.

## Identidad, legal y consentimiento

- [ ] La identidad natural responsable, identificación, domicilio y canales reales están revisados en términos, privacidad y reembolsos.
- [ ] `LEGAL_IDENTITY_READY=true` solo después de esa revisión.
- [ ] Consentimiento de analítica verificable; rechazo mantiene GA4 descargado.

## Infraestructura aislada

- [ ] `/etc/luenio/production.env`, `staging.env` y `edge.env` existen con permisos `600`.
- [ ] Supabase, secretos, Turnstile, Sentry, GA4, n8n y volúmenes son distintos por entorno.
- [ ] `ENABLE_AGENCY_CRM=false`; el lanzamiento no depende de Neon.
- [ ] Los dos stacks usan el mismo `LUENIO_IMAGE=ghcr.io/...@sha256:...`; no se despliegan tags.
- [ ] Caddy es el único servicio con `80/443`; app y n8n no publican puertos.

## Servicios externos

- [ ] Supabase: schema aplicado, RLS activo, prueba anon negativa y primer admin con MFA.
- [ ] Resend: dominio verificado, SPF/DKIM/DMARC y prueba real de contacto, acceso y MFA.
- [ ] n8n: workflows importados, tokens únicos, editor detrás de Cloudflare Access.
- [ ] GA4: eventos de CTA, WhatsApp, demos y cotización visibles en DebugView.
- [ ] Sentry: frontend/servidor reciben error de prueba, release correcto y sin PII.
- [ ] R2: backup `age` subido y restaurado en volumen vacío.
- [ ] Better Stack: health/TLS activos y alerta de prueba recibida.

## Gate de código

```bash
npm ci
npm audit --audit-level=high
npm test
npm run lint
npm run format:check
npm run build
```

- [ ] `npm run preflight:production -- --env-file /etc/luenio/<entorno>.env` pasa con cada archivo real, modo `600` y sin imprimir secretos.
- [ ] `npm run preflight:edge -- /etc/luenio/edge.env` pasa sin imprimir secretos.
- [ ] CI conserva diagnósticos de fallo y el manifiesto OCI indica el commit y digest revisados.

## Staging bloqueante

- [ ] Formulario real + Turnstile y prevención de doble envío.
- [ ] Lead persiste con n8n apagado y se entrega al reactivarlo.
- [ ] Invitación, expiración, reset, revocación y MFA admin.
- [ ] Aislamiento entre dos empresas; anon Supabase denegado.
- [ ] Home con tres demos destacadas ↔ catálogo `/demos` con siete landings ↔ siete simulaciones ↔ cotización/WhatsApp.
- [ ] Responsive a 320, 375, 768, 1024 y escritorio; teclado y zoom 200%.
- [ ] Origen directo bloqueado; staging y automation-staging noindex.
- [ ] Health autenticado: `criticalReady: true`, `storage.mode: "supabase"`.

## Promoción

```bash
sudo bash ops/deploy-environment.sh staging /etc/luenio/staging.env
sudo bash ops/deploy-edge.sh /etc/luenio/edge.env
# Tras aprobar staging, mismo LUENIO_IMAGE:
sudo bash ops/deploy-environment.sh production /etc/luenio/production.env
```

- [ ] `luenio-health@production.timer`, `luenio-health@staging.timer`, backup y maintenance activos.
- [ ] Smoke remoto y formulario real pasan después de producción.
- [ ] Imagen anterior conservada y rollback ensayado.
- [ ] Commit, digest, aprobación y hora UTC registrados sin secretos ni PII.
- [ ] Contactos de guardia y escalamiento están completos; una alerta de prueba fue recibida.
- [ ] Restore validado en volumen vacío; un fallo de extracción no arranca datos parciales.

No son parte del lanzamiento lead-gen: checkout público, multi-workspace de agencia e integración nativa de WhatsApp Business.
