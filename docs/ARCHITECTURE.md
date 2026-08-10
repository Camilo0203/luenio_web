# Arquitectura Luenio

## Vista de cajas

```text
Visitante
  → Cloudflare (DNS, TLS, WAF, bots)
  → Caddy (TLS origen, reverse proxy, X-Luenio-Proxy-Secret)
  → Node server.js
       ├─ estáticos (dist/ en prod; apps/ + public/ en dev)
       ├─ api/*  (handlers delgados)
       │    └─ api/services/*  (auth, contact, leads, billing…)
       ├─ core/*  (scoring, pipeline, lead-engine, events)
       └─ db/storage.js  (única frontera a datos)
            ├─ Supabase (prod, REQUIRE_SUPABASE=true)
            └─ JSON local (dev/tests)

Caddy también → n8n (automation.luenio.com, red Docker separada)
```

## Flujo de lead público

```text
1. Formulario (home / cotización / nicho / demo)
2. POST /api/contact
     - JSON, tamaño, same-origin, Turnstile, honeypot, tiempo mínimo
3. Persistencia: contact_inquiries (+ cola de delivery)
4. Respuesta pública: { ok, inquiryId }  (sin PII de backend)
5. Worker o intento: webhook n8n CONTACT_* (HTTPS + bearer)
6. n8n → SMTP al equipo comercial
```

Si n8n está caído, el lead **ya está en Supabase** y se reintenta con el worker.

## Flujo CRM privado

```text
1. Admin crea invitación (72 h, un uso) → n8n email
2. Usuario acepta → password hash PBKDF2 → membership
3. Login → MFA admin (código 10 min) → cookie sesión __Host-
4. GET /api/leads → listado del business_id
5. POST /api/process
     - crear/procesar lead (scoring core)
     - o actualizar: etapa, notes, tags, nextAction, logContact
     - o mode: digest (preview)
6. Automatización: webhooks CRM/WA/email según plan
```

## Apps

| Ruta              | Origen                       |
| ----------------- | ---------------------------- |
| `/`               | `apps/web/pages/home`        |
| `/cotizacion`     | `apps/web/pages/pricing`     |
| `/gimnasios` etc. | nichos en `apps/web/pages/*` |
| `/demos`          | catálogo de siete demos      |
| `/demo/*`         | simulaciones interactivas    |
| `/login`          | `apps/admin/auth.html`       |
| `/dashboard`      | `apps/admin/admin.html`      |

`/dashboard` + Supabase es el único producto privado del lanzamiento. El CRM de agencia sobre
Neon se conserva como laboratorio reversible: solo se carga cuando `ENABLE_AGENCY_CRM=true`; con
el valor predeterminado `false`, `/app` y `/crm` redirigen a `/dashboard` y `/api/crm/*` responde
404 sin abrir una conexión Neon.

## Seguridad (resumen)

- Fail-closed en `NODE_ENV=production` (`server.js` assert)
- CSP, rate limits, cookies Secure/HttpOnly/SameSite
- RLS Supabase; solo `service_role` desde servidor
- Billing público off por defecto en v1

## Tests browser (P1.6)

- `npm run test:browser` — Playwright (Chromium) + axe-core
- Arranca `server.js` en puerto libre (o usa `BROWSER_E2E_BASE_URL`)
- Smoke UI: home, cotización, nicho, login, dashboard sin sesión, privacidad
- a11y: falla el gate en violaciones **critical/serious** (WCAG 2 A/AA)
- CI instala Chromium con `npx playwright install chromium --with-deps`
- Primera vez en local: `npm run playwright:install`

## Dónde NO poner lógica

- No fetch a Supabase desde el browser
- No secretos en `apps/*`
- No scoring “de confianza” en el cliente (el score lo pisa el servidor)
