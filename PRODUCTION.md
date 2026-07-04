# Luenio SaaS CRM - Production Setup

This project runs as a multi-tenant lead capture, scoring, CRM, pipeline, billing, and automation system.

## Architecture

The project is split by responsibility:

- `apps/web`: public SaaS landing experience and lead capture UI.
- `apps/admin`: protected CRM, auth screens, billing UI, and workspace dashboard.
- `apps/*/src/api-client.js`: frontend API access layer; UI modules do not call `fetch` directly.
- `api`: HTTP handlers and `api/router.js` for auth, leads, process, billing, settings, health, contact, and Stripe webhooks.
- `api/services`: backend services for auth, Stripe checkout, public contact delivery, and automation execution.
- `core`: pure business engine for lead scoring, pipeline stages, lead normalization, workflow selection, automation planning, and CRM lifecycle event construction. It does not perform network I/O or read runtime environment variables.
- Client payloads cannot set lead score, score reasons, classification, or initial pipeline stage. Those values are computed by `core` and only pipeline updates can move an existing lead after creation.
- `db`: persistence adapter for Supabase and local JSON fallback (`db/leads-db.json` in development).
- `db/leads-db.example.json` is the versionable empty fallback shape; `db/leads-db.json` is runtime-only, gitignored, and must not contain real tenant data in the repository.
- `config`: centralized runtime environment access, billing plans, and production readiness checks.
- `scripts`: E2E and production guard tests.
- `public`: static brand assets.

Runtime routes remain stable after the refactor:

- `/` and `/index.html` serve `apps/web/pages/home/index.html`.
- `/login` serves `apps/admin/auth.html`.
- `/dashboard` serves the protected CRM dashboard.
- `/auth.html` remains as a backwards-compatible auth route.
- `/admin.html` and `/admin` remain as backwards-compatible protected dashboard routes.
- `/Pagina Luenio` is mapped to the public landing to avoid legacy local-path 404s.

Static serving is environment-aware:

- Development (`npm run dev`) serves app source from `apps/*` and static assets from `public`.
- Production (`NODE_ENV=production` or `SERVE_DIST=true`) serves the built Vite output from `dist`.
- Production mode intentionally does not fall back to source files if `dist` is missing; run `npm run build` before starting a production deployment.
- Static routes are whitelisted so project files such as `package.json`, `.env`, and path traversal requests are not exposed.
- Static routes only allow `GET` and `HEAD`; unsupported methods return `405`.
- Built Vite assets under `/assets/` use immutable cache headers in production.

## 1. Supabase database

1. Create a Supabase project.
2. Open the SQL editor.
3. Run `supabase/schema.sql`.
4. Copy the project URL and service role key.

Required environment variables:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
REQUIRE_SUPABASE=true
AUTH_SECRET=replace-with-a-long-random-secret
COOKIE_SECURE=true
NODE_ENV=production
APP_URL=https://your-production-domain.com
HOST=0.0.0.0
RATE_LIMIT_MAX=120
SENSITIVE_RATE_LIMIT_MAX=30
MAX_BODY_BYTES=1000000
```

`REQUIRE_SUPABASE=true` prevents production from silently falling back to the local JSON database.
Use `HOST=0.0.0.0` for container/PaaS deployments that need the server to accept external traffic; local development can keep `HOST=127.0.0.1`.
`SENSITIVE_RATE_LIMIT_MAX` applies a stricter per-IP, per-route limit to auth, contact, leads, process, billing, and settings APIs. Keep both rate limit values positive before launch.

Every CRM record is scoped by `user_id`:

- users
- leads
- events
- pipeline_stages
- lead_actions
- lead_notifications
- subscriptions

Pipeline updates are also tenant-scoped. Updating a lead outside the current workspace returns `404` and does not create audit events.
Pipeline stages are restricted to `new`, `qualified`, `contacted`, and `converted`; invalid stage updates return `400`.
The Supabase schema also enforces critical data invariants for plans, lead scores, classifications, and pipeline stages so external writes cannot bypass application logic.

## 2. Automation integrations

Configure any external automation endpoints you need:

```env
CONTACT_WEBHOOK_URL=https://your-zapier-make-or-n8n-webhook/contact
LUENIO_WEBHOOK_URL=https://your-n8n-instance/webhook/luenio-leads
LUENIO_CRM_WEBHOOK_URL=https://your-crm-instance/webhook/leads
LUENIO_WHATSAPP_WEBHOOK_URL=https://your-whatsapp-provider/webhook
LUENIO_EMAIL_WEBHOOK_URL=https://your-email-provider/webhook
```

Automation rules:

- Score `>= 80`: hot lead workflow, CRM deal, CRM webhook, WhatsApp notification, sales owner assignment.
- Score `>= 60`: qualified follow-up, CRM record, CRM webhook, email notification.
- Score `< 60`: nurture flow, CRM record, nurture segment, scheduled follow-up, CRM webhook.

Plan gating stores restricted automation actions in `lead_actions.restricted_actions`, so the CRM can show upgrade prompts even after the initial lead response.

Lead creation records lifecycle events for the live activity feed:

- `message.received`
- `intent.classified`
- `crm.updated`
- `followup.triggered`
- `automation.triggered`
- `lead.created`

## 3. Stripe billing

Create three Stripe recurring prices and configure:

```env
STRIPE_SECRET_KEY=replace-with-stripe-secret-key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
STRIPE_STARTER_PRICE_ID=price_starter
STRIPE_PRO_PRICE_ID=price_pro
STRIPE_AGENCY_PRICE_ID=price_agency
APP_URL=https://your-production-domain.com
```

Plans:

- Starter: 100 leads/month
- Pro: 1,000 leads/month
- Agency: 10,000 leads/month

Registration only accepts known plan IDs: `starter`, `pro`, and `agency`.
Lead creation and full lead processing enforce the active user's monthly plan limit for the current billing period.
Recent duplicate public inquiries and CRM leads are rejected by normalized phone number within a 90-second window.

Stripe webhook endpoint:

```text
/api/stripe-webhook
```

Handled events:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

The webhook verifies the Stripe signature with a 5-minute timestamp tolerance and updates the tenant plan, subscription status, and audit events.
In production, `STRIPE_WEBHOOK_SECRET` is mandatory; malformed, stale, or invalid signatures return `400`.

## 4. Validation

Start the server:

```bash
npm run dev
```

`npm run dev` starts the full SaaS server with API, auth, dashboard, billing, and static app routes. Use `npm run dev:vite` only when you need the Vite-only frontend server.
Set `HOST=0.0.0.0` only when your runtime or tunnel requires external binding.

Check health:

```bash
curl http://127.0.0.1:4180/api/health
```

Expected production health:

```json
{
  "ok": true,
  "storage": {
    "mode": "supabase",
    "supabaseConfigured": true,
    "supabaseRequired": true
  }
}
```

`/api/health` also returns `readiness.checks`, `readiness.criticalReady`, and `readiness.ready`.
Critical readiness checks include production runtime mode, HTTPS APP_URL, built static asset serving, API rate limits, Supabase, AUTH_SECRET, secure cookies, Stripe secret/webhook, and Stripe price IDs.

Run automated checks:

```bash
npm test
```

`npm test` is the production gate. It runs build, architecture boundaries, auth security, core trust boundary, data hygiene, production readiness, development port fallback, endpoint rate limits, Supabase schema guard, strict storage, Stripe webhook guard, development smoke, production smoke, and the full SaaS E2E flow with a temporary server.

`npm run test:e2e` verifies the SaaS loop:

Public contact capture -> auth registration -> lead capture -> scoring -> tenant storage -> automation actions -> lead retrieval -> pipeline update -> admin route -> billing plans.

`npm run test:smoke` starts `server.js` on a temporary local port and verifies the public landing, legacy local route, protected admin redirect, JSON API 404s, and health endpoint.

`npm run test:smoke:prod` starts the same server with `NODE_ENV=production` and verifies the landing is served from built Vite assets instead of source modules.

## 5. Auth and protected routes

Open:

```text
http://127.0.0.1:4180/login
```

The system includes:

- registration
- login/logout
- signed HttpOnly session cookie
- malformed session tokens and damaged password hashes fail closed without crashing requests
- `Secure` session cookies in production or when `COOKIE_SECURE=true`
- `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, and `Permissions-Policy` headers
- HSTS is enabled when serving the production build
- `no-store` cache policy for auth/admin pages and JSON API responses
- same-origin validation for mutable API requests, excluding signed Stripe webhooks
- `application/json` enforcement for mutable API requests, excluding signed Stripe webhooks
- JSON `404` responses for unknown `/api/*` routes
- protected `/api/leads`, `/api/process`, and `/api/billing`
- per-user tenant isolation
- global API rate limiting plus stricter per-route limits for sensitive endpoints
- JSON request validation with `400` responses for invalid payloads
- malformed encoded paths return `400`
- request body size protection via `MAX_BODY_BYTES` with `413` responses for oversized payloads

## 6. CRM dashboard

Open:

```text
http://127.0.0.1:4180/dashboard
```

The dashboard shows:

- lead totals
- hot, warm, cold filters
- status filters
- pipeline columns
- source tracking
- lead detail view
- launch checklist from `/api/settings`
- production readiness checks from `/api/settings`
- system health for database and integrations
- billing plans and checkout trigger
- current monthly lead usage and remaining allowance
- automatic polling for live lead updates
- live sync status feedback
- skeletons only on initial load, with silent background CRM refreshes afterward
- live automation event feed

## 7. Public lead flow

The public landing is trust-first and conversion-focused:

- unauthenticated visitors post to `POST /api/contact`
- public inquiries are persisted before optional `CONTACT_WEBHOOK_URL` delivery, so webhook outages do not drop leads
- duplicate public inquiries are handled by the backend; the browser does not persist lead PII in localStorage
- the form uses one primary CTA: `Automatizar mi negocio`
- public UI avoids fake dashboards, scoring animations, live feeds, and simulator language

Authenticated CRM users create scored leads through `POST /api/leads` from the admin/API flow. The CRM API returns the final score, classification, pipeline stage, workflow, restricted actions, and integration results.

## 8. Deployment

This project deploys to a self-managed VPS via Docker; see `DEPLOYMENT.md` for the full server setup, `docker compose`, and reverse-proxy/TLS runbook. The environment variables documented above apply identically whether running via `npm run dev`/`node server.js` directly or inside the Docker container.
