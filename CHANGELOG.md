# Changelog

## Sin publicar

### Contenido y descubrimiento

- Nueva sección `/guias` con tres artículos de fondo: WhatsApp Business frente a WhatsApp
  Business API, qué resuelve y qué no un chatbot de WhatsApp, y cómo conectar la web con
  WhatsApp sin perder el origen de cada conversación. Las guías se declaran una sola vez en
  `config/guides.js`, igual que los sectores, así que rutas, entradas de build y filas del
  sitemap se derivan de ahí.
- Las guías reutilizan el chasis de documento de las páginas legales: ese CSS ya trae tema claro
  y oscuro y disposición móvil, de modo que no hacen falta baselines visuales nuevos.
- Enlace a Guías en las tres variantes del pie, y las guías añadidas a `llms.txt`.

### SEO

- La home describe a Luenio como `ProfessionalService` con dirección, zona de cobertura, punto
  de contacto, temas que domina y un catálogo con los siete servicios por sector, cada uno
  enlazado al nodo `Service` que su propia landing ya declara.
- Las siete landings apuntan su `provider` al mismo `@id`, de forma que el grafo resuelve a una
  entidad en vez de a ocho copias sueltas.
- Las guías publican `Article`, `FAQPage` y `BreadcrumbList`; el índice publica
  `CollectionPage` e `ItemList`.

### Calidad

- `architecture-test.mjs` deriva de las tablas cuántas páginas deben usar la cabecera y el pie
  compartidos, en vez de comprobarlo contra un número escrito a mano.

## 2026.8.1 - Release candidate

### Lanzamiento

- Sitio público, cotización, siete landings y siete simulaciones unificados para producción.
- **Portal de cliente fuera de la superficie pública** (`PUBLIC_DEMO_MODE=true`): acceso,
  invitaciones, reset, `/dashboard`, `/app` y `/crm` redirigen a `/demos` y sus APIs responden
  `404`. El código se conserva para reactivarlo en una fase posterior.
- CRM de agencia congelado con `ENABLE_AGENCY_CRM=false`; el lanzamiento no depende de Neon.
- Gate de producción determinista con 35/35 controles, regresión visual, matriz responsive,
  auditoría de tema y presupuestos de rendimiento.
- Imagen prevista como `luenio-app:2026.08.1` y release Sentry `luenio@2026.08.1`.

### Accesibilidad

- Los enlaces de ancla mueven el foco además del viewport; el "saltar al contenido" ya funciona.
- Anillos de foco con contraste suficiente (antes ~1.6:1, por debajo del 3:1 de WCAG 1.4.11).
- Corregidos `aria-hidden` inválido en el disparador de WhatsApp, `aria-busy` que silenciaba el
  estado de las simulaciones, `aria-label` en elementos sin rol y nombre accesible que no contenía
  el texto visible.
- El banner de consentimiento ya se muestra con estilos en las siete páginas `/demo/*`.

### Legal y SEO

- Las siete landings sectoriales enlazan Términos, Privacidad y Reembolsos; la home añade
  Reembolsos.
- `robots.txt` deja de bloquear `/demo/` y los alias en inglés: su exclusión la aplican `noindex`
  y el canonical, que exigen que la página sea rastreable.
- Añadido JSON-LD (`Organization`, `WebSite`, `FAQPage`, `Service`, `BreadcrumbList`).

### Rendimiento

- `/demo/real-estate` pasa de 225 KB a 78 KB y `/demos` de 222 KB a 104 KB; la página más pesada
  queda al 60% del presupuesto de 250 KB.
- Previews móviles generadas para los siete sectores desde `npm run previews:sectors`.

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
