# Runbook operativo Luenio

Complementa [SECURITY.md](../SECURITY.md) y [DEPLOYMENT.md](../DEPLOYMENT.md).

## Convención de entornos

Los comandos operativos siempre nombran el proyecto y su archivo:

```bash
docker compose -p luenio-production --env-file /etc/luenio/production.env ps
docker compose -p luenio-staging --env-file /etc/luenio/staging.env ps
docker compose -f ops/edge-compose.yml -p luenio-edge --env-file /etc/luenio/edge.env ps
```

No uses un `.env` implícito.

## Bootstrap del primer administrador

No hay registro público. Aplica el schema, usa `supabase/bootstrap.example.sql` como plantilla y verifica login con MFA en staging. Nunca pegues contraseñas o hashes en tickets.

## Health

```bash
curl -sS https://luenio.com/api/health
curl -sS -H "Authorization: Bearer $HEALTHCHECK_TOKEN" \
  "https://luenio.com/api/health?details=1"
```

Producción requiere `criticalReady: true` y `storage.mode: "supabase"`. Revisa timers con `systemctl list-timers 'luenio-*'`.

## Rotación de secretos

1. Genera valores nuevos con `openssl rand -hex 32`.
2. Cambia solo `/etc/luenio/<entorno>.env` y su correspondiente secreto edge.
3. Ejecuta `npm run preflight:production -- --env-file /etc/luenio/<entorno>.env` y `npm run preflight:edge -- /etc/luenio/edge.env`.
4. Redeploy del entorno; recarga edge si cambió proxy.
5. Actualiza Header Auth en esa instancia n8n y revoca sesiones si aplica.
6. Registra hora UTC y alcance sin PII.

No rotes ambos entornos simultáneamente. Orden sugerido: auth, proxy, health, webhooks y finalmente service role.

## n8n caído

1. Confirma que contacto responde correctamente y existe en `contact_inquiries`.
2. Revisa cola y worker.
3. Restaura la instancia del entorno; el worker reintenta con backoff.
4. No reenvíes PII manualmente.

## Backup y restore

```bash
sudo systemctl start luenio-backup.service
sudo journalctl -u luenio-backup.service --since today

# Destinos válidos: n8n-production, n8n-staging, caddy
AGE_IDENTITY_FILE=/ruta/offline \
  sudo -E bash ops/restore-volumes.sh n8n-staging archivo.tar.age
```

Restaura siempre en un volumen vacío y ensaya trimestralmente. Sin el `N8N_ENCRYPTION_KEY` correspondiente no se recuperan credenciales.

## Deploy y rollback

```bash
sudo bash ops/deploy-environment.sh staging /etc/luenio/staging.env
# aprobar staging y mantener exactamente el mismo LUENIO_IMAGE por digest
sudo bash ops/deploy-environment.sh production /etc/luenio/production.env
```

Para rollback, cambia `LUENIO_IMAGE` por el digest OCI anterior y repite el comando. El despliegue valida health autenticado y solo revierte automáticamente a una referencia anterior también fijada por digest.

## Promoción por digest

1. Ubica una ejecución CI verde de `main` o `master` para el commit aprobado.
2. Descarga `oci-image-<git-sha>` y verifica que `GIT_SHA` sea el commit revisado.
3. Configura su `ghcr.io/...@sha256:...` en staging y completa preflight y pruebas externas.
4. Registra commit, digest, aprobación y hora UTC.
5. Copia el mismo digest a producción. Nunca reconstruyas ni uses un tag durante promoción.

No hay despliegue automático desde CI. Si el gate falla, usa `gate-diagnostics-*`; no adjuntes `.env`, dumps, cookies, headers ni respuestas privadas de health.

## Analytics y observabilidad

- GA4 es obligatorio: configura un Measurement ID por entorno y valida los eventos en DebugView después del consentimiento.
- Sentry requiere DSN de servidor y público, `SENTRY_RELEASE` inmutable y environment correcto.
- Una prueba Sentry no debe incluir nombre, email, teléfono, cookies, headers ni payloads.
- Better Stack monitorea health público y TLS. El diagnóstico privado permanece en los timers locales.

## Contactos de emergencia

| Rol                        | Canal                  |
| -------------------------- | ---------------------- |
| Responsable legal/producto | Pendiente de completar |
| Hosting / VPS              | Pendiente de completar |
| Supabase                   | Pendiente de completar |
| Cloudflare / DNS           | Pendiente de completar |
| Resend / observabilidad    | Pendiente de completar |

La publicación está bloqueada mientras cualquiera de estos responsables o canales siga pendiente. No se sustituyen con datos inventados.

## Incidentes y alertas

1. Confirma alcance con health público y luego health autenticado desde el host protegido.
2. Registra inicio UTC, digest y síntomas sin PII ni secretos.
3. Si el cambio causó el incidente, vuelve al digest anterior; no reviertas datos automáticamente.
4. Si afecta almacenamiento, detén escrituras y sigue el restore validado. Una extracción fallida debe permanecer detenida.
5. Prueba el canal de alertas antes del lanzamiento y trimestralmente. No recibirla es un bloqueo operativo.
