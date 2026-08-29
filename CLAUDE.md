# CLAUDE.md

Luenio: sitio de lead generation. Un visitante llega por una landing de sector,
pide cotización, y el lead sale hacia n8n. El scoring es **por reglas** (léxico de
intención), no un LLM.

## Estado del lanzamiento

Solo la superficie pública está viva. El portal de cliente y el CRM están
**congelados a propósito** y volverán más adelante:

- `PUBLIC_DEMO_MODE=true` redirige `/login`, invitaciones, reset, `/dashboard`,
  `/app` y `/crm` hacia `/demos`; sus APIs responden `404`.
- `ENABLE_AGENCY_CRM=false` mantiene apagado el CRM de agencia.

El código de esa superficie sigue en el repo. No lo borres ni lo "limpies" por
parecer muerto: `apps/admin/`, `components/`, `api/services/crm-*`, `lib/db/` y
los tests de CRM/auth/billing existen para reactivarse.

## Comandos

```bash
npm run dev        # servidor sobre el árbol de fuentes, http://127.0.0.1:4180
npm run build      # Vite -> dist/
npm test           # gate completo, 35 pasos, ~13 min
npm run test:quick # lint + build + arquitectura, errores de API y núcleo
npm run lint       # eslint
npm run format     # prettier --write
```

Un paso suelto del gate se corre por nombre: `npm run test:smoke`,
`npm run test:visual`, `npm run test:browser`, etc. (ver `package.json`). El gate
los orquesta desde `scripts/production-gate.mjs` con un entorno aislado.

## Dónde vive qué

```text
server.js          HTTP, seguridad, estáticos. Delega las APIs a api/router.js
api/               Handlers delgados + api/services/ con la lógica
core/              Scoring, pipeline, eventos de dominio. Sin I/O, sin env
db/storage.js      Única frontera de persistencia (Supabase o JSON local)
config/            env.js, readiness.js, billing.js, sectors.js
lib/               html-includes.js, public-routes.js, sentry.js, db/, api/
apps/web/          Sitio público: pages/, src/, partials/
apps/admin/        Login, invitaciones, dashboard, CRM (congelados)
scripts/           Tests del gate + herramientas de operación
tests/             Baselines de regresión visual (PNG)
```

Sí: los tests viven en `scripts/`, mezclados con herramientas de operación
(`db-migrate.mjs`, `create-admin.mjs`, `hash-password.mjs`), y `tests/` solo
guarda los PNG de referencia. Es confuso y es deuda conocida: mover los 39
archivos de test toca las 40 entradas `test*` de `package.json` y el gate entero,
así que se dejó para después del lanzamiento.

`design-proposals/`, `source-assets/` y `.impeccable/` están en `.gitignore`: son
archivos de trabajo de diseño, viven en el disco y siguen recuperables desde la
historia con `git show <rev>:<ruta>`. No los vuelvas a rastrear.

## Reglas que el gate hace cumplir

`scripts/architecture-test.mjs` falla si las rompes. No son estilo, son fronteras:

- Solo `config/env.js` y `server.js` leen `process.env`. Todo lo demás pide
  configuración a `config/env.js`.
- `core/` no hace red, no lee env, no importa `config/`, `api/`, `db/` ni `apps/`,
  y no usa `Math.random` para ids.
- `db/` persiste eventos de dominio, no los construye.
- `server.js` no importa handlers de API directamente; pasa por `api/router.js`.
- Las rutas públicas se derivan de `config/sectors.js`, no se escriben a mano.

## Añadir un sector

`config/sectors.js` es la lista única de los siete sectores. De ella salen las
rutas del servidor (`/gimnasios`, `/gym`, `/demo/gym` y sus alias con y sin barra
final), las entradas de build de Vite, las URLs del sitemap y las listas de los
tests. Un sector nuevo son **dos páginas** (`apps/web/pages/<id>/` y
`apps/web/pages/demo/<id>/`) y **una fila** en la tabla.

## Cabecera, pie y barra legal

Las páginas públicas declaran su chrome en vez de repetirlo:

```html
<!-- include: site-header nav="site" ctaHref="/cotizacion" quoteCta="header" ctaLocation="legal_header" -->
```

Los bloques están en `apps/web/partials/`. La expansión la hace
`lib/html-includes.js` desde dos sitios: el plugin de Vite (build y `vite dev`) y
`server.js` cuando sirve el árbol de fuentes. Producción sirve `dist/`, ya
expandido.

- Los partials están en `.prettierignore`: llevan `{{#if}}` y prettier los
  rompería. Formatéalos a mano.
- Un parámetro que falte, uno que el partial no mencione, o una directiva mal
  escrita **lanzan**. Nunca se sirve una página sin cabecera.
- El 404 se envía fuera de `serveStatic`, por `sendNotFound`. Si añades otra ruta
  que mande HTML por su cuenta, pásala por `readHtmlDocument()`.

## Producción

`assertSecureProductionRuntime()` (server.js) valida ~20 invariantes al arrancar
con `NODE_ENV=production` y **mata el proceso** si falta alguna: HTTPS en
`APP_URL`, secretos de 32+ caracteres, Supabase estricto, Turnstile obligatorio,
worker de entrega de contactos activo con límites sanos. Si añades una
dependencia crítica de entorno, valídala ahí.

El lead se **persiste primero y se entrega después**: `storePublicInquiry()`
guarda la consulta y encola una entrega; el worker reintenta el webhook. Si
tocas ese camino, mantén ese orden — es lo que impide perder un lead cuando n8n
está caído.

En producción `REQUIRE_SUPABASE=true`. El JSON de `db/leads-db.json` es solo para
desarrollo y el arranque de producción falla sin Supabase.

## Detalles que muerden

- **Un servidor de desarrollo ya arrancado no recoge los cambios de `server.js`.**
  Desde que la cabecera y el pie se expanden en el servidor, un proceso viejo
  sirve las páginas con la directiva `<!-- include: … -->` sin expandir: sin
  cabecera y sin pie, en silencio. Antes bastaba con editar el HTML. Si el sitio
  aparece sin barra de navegación, reinicia `npm run dev` antes de buscar el fallo
  en otro sitio.
- **Prettier manda en el formato.** El gate no lo corre, pero CI sí
  (`npm run format:check`). Pasa `npm run format` antes de terminar.
- **Los tests leen las páginas expandidas**, vía `scripts/page-source.mjs`. Si
  añades una aserción sobre markup compartido, usa ese helper y no
  `readFileSync`.
- **Un cambio visual intencionado necesita baselines nuevos**:
  `npm run test:visual:update`. Revisa el diff antes de aceptarlo.
- **El test de regresión visual borra su carpeta de resultados cuando falla**
  (`visual-regression-test.mjs`), así que el `.diff.png` que menciona el error
  desaparece. Si necesitas verlo, corre el escenario suelto.
- **Idioma:** la copy del producto y la documentación van en español; el código,
  los comentarios y los mensajes de commit, en inglés.
