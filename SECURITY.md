# Seguridad de Luenio

Este documento es parte del despliegue, no una recomendación opcional. El servidor se niega a iniciar en `NODE_ENV=production` cuando faltan Supabase estricto, Turnstile, entrega autenticada, MFA administrativo, secretos del proxy o diagnóstico privado.

## Controles incluidos en el código

- Sesiones opacas de 256 bits; en la base solo se almacena SHA-256 del bearer token.
- Cookies `__Host-`, `Secure`, `HttpOnly`, `SameSite=Strict` y `Priority=High`.
- Sesiones revocables, máximo de diez sesiones por usuario y expiración de 24 horas.
- Un cambio de contraseña revoca todas las sesiones activas.
- PBKDF2-HMAC-SHA256 asíncrono con 600.000 iteraciones, salt aleatorio y migración de hashes antiguos al iniciar sesión.
- Concurrencia y cola de hashing acotadas para impedir agotamiento de CPU/memoria mediante intentos distribuidos.
- Respuesta temporal uniforme para cuentas existentes e inexistentes.
- Bloqueo persistente por combinación de identidad/IP y por IP después de intentos fallidos, evitando que terceros bloqueen globalmente una cuenta ajena.
- MFA obligatorio para administradores, con código de un solo uso, diez minutos de vigencia y cinco intentos.
- Invitaciones, recuperación de contraseña, MFA y deduplicación de contactos consumidos mediante transacciones PostgreSQL.
- RLS forzado en todas las tablas; `anon` y `authenticated` no tienen permisos directos. Solo el backend con `service_role` accede a los datos.
- Aislamiento del CRM por `business_id`; una actualización siempre filtra lead y empresa simultáneamente.
- Turnstile validado en servidor, honeypot, tiempo mínimo de formulario y tokens de acción/hostname.
- Cola persistente para notificaciones de contacto, reclamo atómico, bloqueo temporal y reintentos con backoff; una caída de n8n no elimina el lead ni abandona silenciosamente la entrega.
- Allowlist de `Host`, validación de `Origin` y Fetch Metadata para mutaciones.
- Secreto compartido Caddy → Node; una request directa al proceso Node recibe `421`.
- IP del cliente tomada únicamente de Caddy después de validar el proxy.
- CSP, HSTS, COOP, CORP, protección anti-frame, `nosniff`, políticas de permisos y ausencia de CORS público.
- Body máximo de 64 KB, URL máxima de 2 KB, timeouts HTTP y límite de requests por socket.
- Rate limits por IP/ruta con memoria acotada; el perímetro Cloudflare sigue siendo obligatorio.
- `/api/health` solo expone liveness. Diagnósticos, integraciones y storage requieren `HEALTHCHECK_TOKEN`.
- Las respuestas de contacto, auth y CRM no revelan proveedor de almacenamiento, webhooks, URLs ni errores internos.
- Contenedores read-only, sin capacidades Linux, `no-new-privileges`, límites de CPU/RAM/PID y redes separadas.
- Backups cifrados con `age`, checksum y réplica offsite mediante `rclone`.

## Configuración obligatoria de Cloudflare

1. Añadir `luenio.com` a Cloudflare y dejar `luenio.com`, `www`, `staging`, `automation` y `automation-staging` en modo **Proxied**.
2. Usar TLS `Full (strict)`, TLS mínimo 1.2, TLS 1.3 y Always Use HTTPS.
3. Mantener activos los rulesets DDoS y WAF administrados de Cloudflare.
4. Activar protección de bots disponible en el plan contratado.
5. Crear reglas de rate limiting en el edge:
   - `/api/contact`: 10 POST por minuto/IP; después Managed Challenge.
   - `/api/auth`: 10 POST por minuto/IP; después bloquear 15 minutos.
   - `/api/password-reset/*`: 5 POST cada 10 minutos/IP.
   - `/api/invitations/accept`: 10 POST cada 10 minutos/IP.
   - Resto de `/api/*`: 120 requests por minuto/IP.
6. No cachear `/api/*`, `/login`, `/dashboard`, `/admin*`, `/aceptar-invitacion*` ni `/restablecer-acceso*`.
7. Cachear assets con hash bajo `/assets/*`; respetar el header `immutable` del origen.
8. Crear aplicaciones Cloudflare Access para `automation.luenio.com` y `automation-staging.luenio.com` con MFA y allowlist del equipo. Los paths `/webhook/*` deben usar una política Service Auth o bypass limitado, porque cada workflow ya exige su bearer token propio.
9. Activar DNSSEC, bloqueo de transferencia del dominio, bloqueo del registrador y MFA resistente a phishing en registrador y Cloudflare.
10. Rotar la IP del VPS si alguna vez estuvo publicada antes de Cloudflare.

## Bloqueo del origen

Cloudflare no protege el VPS si un atacante puede conectarse directamente a su IP. Después de comprobar que el proxy está activo:

```bash
sudo ADMIN_IP_CIDR=TU_IP_PUBLICA/32 sh ops/configure-origin-firewall.sh
```

Aplicar también las mismas reglas en el firewall del proveedor del VPS. Solo deben entrar:

- SSH desde `ADMIN_IP_CIDR`.
- HTTP/HTTPS desde rangos oficiales de Cloudflare.
- Nada más.

Desde una red externa:

```bash
ORIGIN_IP=IP_DEL_VPS sh ops/verify-origin-lockdown.sh
```

El dominio debe responder y la conexión directa mediante `--resolve` debe fallar. Repetir la verificación después de cambios DNS o de proveedor.

## Supabase

1. Crear un proyecto exclusivo para producción con MFA en todas las cuentas administradoras.
2. Ejecutar completo `supabase/schema.sql` con una cuenta propietaria.
3. Verificar en el dashboard que todas las tablas muestran RLS habilitado.
4. No usar ni publicar la clave `anon`; este proyecto accede únicamente desde el servidor con `service_role`.
5. Guardar `SUPABASE_SERVICE_ROLE_KEY` solo en `/etc/luenio/production.env` o `/etc/luenio/staging.env`, permisos `600`, propietario root.
6. Activar backups administrados/PITR según el plan y probar restauración en un proyecto separado.
7. Separar proyectos y credenciales de staging y producción.
8. Instalar y activar `luenio-security-maintenance.timer`; este elimina sesiones, códigos, bloqueos y enlaces expirados, además de aplicar la retención documentada para auditorías y contactos.

Consulta negativa obligatoria con la clave anon, si existe en el proyecto: `users`, `leads`, `contact_inquiries`, `sessions`, `invitations` y `password_resets` deben responder sin filas o con acceso denegado.

## n8n y correo

1. Importar los tres workflows de `n8n/workflows/`.
2. Crear credenciales Header Auth distintas para contacto, acceso y MFA en cada entorno; deben coincidir con los tokens de su archivo `/etc/luenio/<entorno>.env`.
3. Crear credenciales Resend SMTP separadas para staging y producción, con dominio verificado, SPF, DKIM y DMARC.
4. Mantener deshabilitados community packages y acceso a variables de entorno desde Code nodes.
5. No guardar ejecuciones con éxito ni error que contengan leads, enlaces o códigos.
6. Guardar `N8N_ENCRYPTION_KEY` también en un gestor de contraseñas offline. Sin esa clave un backup de n8n no puede recuperar credenciales.

## Backups y restauración

Instalar `age` y `rclone`. La clave privada de `age` no debe residir permanentemente en el VPS. Configurar `/etc/luenio/backup.env` con permisos `600`:

```dotenv
BACKUP_AGE_RECIPIENT=age1...
RCLONE_REMOTE=luenio-r2:production
PRODUCTION_ENV_FILE=/etc/luenio/production.env
STAGING_ENV_FILE=/etc/luenio/staging.env
```

Ejecutar diariamente `luenio-backup.timer`. Cada trimestre:

1. Descargar un archivo y su `.sha256` desde el almacenamiento offsite.
2. Crear un volumen Docker vacío y una instancia aislada.
3. Ejecutar `AGE_IDENTITY_FILE=/ruta/offline ops/restore-volumes.sh n8n-staging archivo.age` contra un volumen de ensayo vacío.
4. Confirmar que las credenciales y workflows abren con la clave de cifrado restaurada.
5. Registrar fecha, duración y resultado; un backup no probado no cuenta como recuperación.

## Monitoreo

- El timer local comprueba conexión a Supabase, `criticalReady` y salud de la cola de entregas, pero no detecta la caída completa del VPS.
- Configurar Better Stack para `https://luenio.com/api/health`, `https://staging.luenio.com/api/health`, certificado TLS y expiración de dominio.
- Alertar por email y teléfono ante dos fallos consecutivos, errores 5xx, volumen >80%, RAM >85% y reinicios repetidos.
- No enviar `HEALTHCHECK_TOKEN` a monitores de terceros salvo que ofrezcan un almacén cifrado de secretos.
- Revisar las primeras 72 horas y luego semanalmente los eventos de Cloudflare, auth bloqueada, Turnstile y fallos de webhook.

## VPS

- Usuario de despliegue independiente; `PermitRootLogin no` y `PasswordAuthentication no`.
- SSH solo con llave Ed25519 protegida y segundo factor del proveedor.
- Actualizaciones automáticas de seguridad y reinicio programado.
- Docker socket accesible únicamente por administradores; pertenecer al grupo `docker` equivale a root.
- `/etc/luenio/*.env`, archivos de monitor y backup con permisos `600`.
- No ejecutar correo, paneles adicionales ni bases de datos públicas en la misma IP.
- Revisar imágenes antes de actualizar y desplegar primero en staging.

## Rotación e incidente

Ante pérdida de un portátil, token, cuenta o sospecha de acceso:

1. Bloquear temporalmente `/login` y `/api/*` en Cloudflare, excepto health.
2. Revocar sesiones afectadas en `public.sessions` o todas las sesiones.
3. Rotar `AUTH_SECRET`, claves Supabase, proxy, health, webhooks, n8n y SMTP. Reiniciar servicios.
4. Revisar `audit_logs`, Cloudflare, proveedor del VPS y Supabase sin copiar PII a tickets públicos.
5. Restaurar desde un backup limpio si existe persistencia o modificación no explicada.
6. Documentar alcance, ventana temporal y datos afectados; seguir las obligaciones legales aplicables.

## Gate de lanzamiento

No publicar hasta que todo sea verdadero:

- `npm test`, lint, formato y audit pasan.
- `npm run preflight:production` pasa con secretos reales.
- `npm run preflight:edge` pasa con los dos secretos proxy.
- `/api/health?details=1` autenticado muestra `criticalReady: true` y `storage.mode: "supabase"`.
- Acceso anon a Supabase está denegado.
- Admin no obtiene sesión sin completar MFA.
- Origen directo bloqueado desde una red externa.
- Lead real persiste aunque n8n esté apagado y se notifica al restaurarlo.
- Backup cifrado offsite y restauración probada.
- `luenio-security-maintenance.timer` activo y última ejecución exitosa.
- Monitor externo genera una alerta de prueba.
- GA4 recibe los eventos de conversión después del consentimiento y Sentry recibe un error de prueba sin PII.
- Staging superó pruebas móviles, escritorio, navegador y seguridad antes de promover la misma imagen.
