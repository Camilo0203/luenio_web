# Luenio — comportamiento de producción

Consulta primero:

- `DEPLOYMENT.md`: procedimiento de despliegue.
- `SECURITY.md`: controles de seguridad, Cloudflare, origen, backup e incidentes.
- `.env.production.example`: contrato de configuración.

## Aplicaciones

## Sitio público sin portal de clientes

`PUBLIC_DEMO_MODE=true` mantiene visible el sitio comercial, la cotización, las siete landings y sus demos. El login, las invitaciones, la recuperación, `/dashboard`, `/app`, `/crm`, los archivos administrativos y sus APIs quedan cerrados y redirigen al catálogo cuando corresponde. El código privado se conserva para una reactivación posterior; la bandera solo debe cambiar a `false` cuando todo el portal de clientes vaya a habilitarse de forma intencional.

Los formularios públicos siguen requiriendo Turnstile, persistencia y webhook reales. En este modo no se ejecuta el digest privado ni se exigen webhooks de invitación, reset o MFA.

El lanzamiento inicial usa únicamente `/dashboard`. `ENABLE_AGENCY_CRM=false` mantiene `/crm`,
`/app` y `/api/crm/*` fuera de la superficie activa y evita depender de Neon.

- `apps/web`: sitio público, cotización, demos y landings de portafolio.
- `apps/admin`: login por invitación y CRM privado.
- `api`: handlers HTTP delgados.
- `api/services`: autenticación, MFA, contacto, automatización y billing.
- `core`: reglas puras de scoring, pipeline y eventos.
- `db/storage.js`: frontera exclusiva hacia Supabase o JSON local de desarrollo.
- `supabase/schema.sql`: esquema, transacciones, índices, RLS y permisos.

El runtime de producción sirve únicamente `dist/`. El contenedor no incluye fuentes de pruebas, documentos, migraciones, secretos ni dependencias npm de runtime.

## Frontera pública

Rutas indexables:

- `/`
- `/cotizacion`
- `/demos`
- las siete landings sectoriales mediante sus URL canónicas en español
- `/terminos`
- `/privacidad`
- `/reembolsos`

Rutas privadas o `noindex`:

- `/login`
- `/dashboard`
- `/aceptar-invitacion`
- `/restablecer-acceso`
- simulaciones interactivas bajo `/demo/*`
- `automation.luenio.com`
- `staging.luenio.com`

`/precios` redirige permanentemente a `/cotizacion`.

## Autenticación

- No existe registro público.
- El administrador crea invitaciones de 72 horas y uso único.
- Contraseñas de mínimo 12 caracteres y máximo 128.
- Hash PBKDF2-HMAC-SHA256 con 600.000 iteraciones y salt aleatorio.
- Sesión opaca persistida como hash, revocable y con duración predeterminada de 24 horas.
- Cookies `__Host-`, `Secure`, `HttpOnly` y `SameSite=Strict`.
- Cambio de contraseña revoca todas las sesiones.
- Administradores completan MFA antes de recibir una cookie de sesión.
- Login fallido se limita por IP/identidad y nunca confirma si una cuenta existe.

## Datos

Producción exige:

```dotenv
REQUIRE_SUPABASE=true
SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=...
```

El esquema:

- fuerza RLS en todas las tablas;
- revoca permisos de `anon` y `authenticated`;
- permite acceso únicamente a `service_role`;
- separa CRM por `business_id`;
- procesa invitación, reset, MFA y deduplicación mediante funciones transaccionales;
- no guarda tokens o códigos en texto plano.

El JSON local existe exclusivamente para desarrollo y pruebas. Docker de producción no monta un volumen para fallback.

## Formularios y webhooks

`POST /api/contact` exige JSON, límites de tamaño, mismo origen, Turnstile, honeypot y tiempo mínimo. El servidor genera ID y fecha, normaliza campos y persiste antes de notificar n8n.

La respuesta pública contiene únicamente:

```json
{
  "ok": true,
  "inquiryId": "inquiry_..."
}
```

No expone Supabase, n8n, destinos, estados HTTP internos ni errores de proveedores.

Todo webhook saliente usa HTTPS, timeout y bearer token propio. n8n no conserva payloads de ejecuciones.

## Health

Público:

```text
GET /api/health
```

Devuelve liveness sin topología interna.

Privado:

```text
GET /api/health?details=1
Authorization: Bearer <HEALTHCHECK_TOKEN>
```

Incluye conexión a Supabase y readiness. El monitor externo público no necesita el token; el monitor operativo protegido sí.

## Billing

La venta pública funciona mediante cotización personalizada:

```dotenv
ENABLE_PUBLIC_BILLING=false
```

Con ese valor, checkout y webhook Stripe fallan cerrados. No actives billing hasta crear una fase específica de pagos, onboarding, impuestos y soporte.

## Arranque fail-closed

En `NODE_ENV=production`, Node se niega a escuchar si falta cualquiera de estos controles:

- APP URL HTTPS y allowlist de hosts;
- secreto y requisito de proxy confiable;
- AUTH secret y token privado de health;
- Supabase estricto;
- Turnstile obligatorio;
- webhook de contacto HTTPS autenticado;
- MFA administrativo autenticado;
- rate limits positivos;
- body máximo dentro del rango seguro.

El gate completo es:

```bash
npm ci
npm audit --audit-level=high
npm test
npm run lint
npm run format:check
npm run preflight:production
```

Después del despliegue:

```bash
npm run preflight:production:remote
```

Una compilación correcta no sustituye Cloudflare, firewall de origen, backups offsite, restauración probada ni monitoreo externo.
