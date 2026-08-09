# Research Findings — Premium Agency CRM (Luenio)

**Fecha:** 2026-07-22  
**Método:** Firecrawl scrape + branding extraction sobre referencias reales  
**Objetivo:** Decisiones accionables de diseño/IA para un CRM de agencia nivel Linear / Attio / Vercel Dashboard

---

## 1. Referencias analizadas

| #   | Producto                   | URL                        | Screenshot / evidencia                   | Notas                                                                                         |
| --- | -------------------------- | -------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------- |
| 1   | **Attio**                  | https://attio.com          | Firecrawl scrape + branding              | CRM “agentic revenue”; pipeline Kanban real en marketing; data tables de companies con scores |
| 2   | **Linear**                 | https://linear.app         | Firecrawl scrape + branding + screenshot | Estándar de UI de producto: board por columnas, densidad alta, motion sutil                   |
| 3   | **Cron (Notion Calendar)** | https://cron.com           | Firecrawl scrape + branding              | Dark premium, tipografía display fuerte, acento naranja `#FF4700`                             |
| 4   | **Untitled UI**            | https://www.untitledui.com | Firecrawl scrape + branding              | Sistema de componentes Figma/React; purple `#7F56D9`, escala Inter, tables y forms            |
| 5   | **Tremor**                 | https://tremor.so          | Firecrawl scrape + branding              | Charts/dashboard components Tailwind; KPI cards + tooltips                                    |
| 6   | **Vercel**                 | https://vercel.com/home    | Firecrawl scrape + branding              | Dashboard aesthetic: Geist, monochrome + azul, base 4px, radius 6px, light/dark nativo        |

### Branding extraído (Firecrawl)

#### Attio

- **Esquema:** light-first, superficies blancas, texto `#2E3238`
- **Primary UI:** botones near-black `#202124` / texto `#F3F4F6`
- **Inputs:** fondo blanco, borde `#D3D8DF`, radius **10px**
- **Base spacing:** **8px**
- **Tipografía:** Inter + Inter Display
- **IA:** sidebar con Home / Pipeline / People / Companies / Reports; ficha lateral de deal; scores ICP en tabla; columnas Discovery → Demo → Proposal → Negotiation

#### Linear

- **Esquema:** dark `#08090A`
- **Accent link:** `#5E6AD2` (indigo Linear)
- **Secondary accent:** lime `#E4F222` (marketing)
- **Botones:** pill `border-radius: 9999px`; primary light-on-dark; secondary con inset highlight
- **Base spacing:** **8px**; radius base **2px** (superficies densas)
- **Tipografía:** Inter / SF Pro Display; body ~15px
- **IA:** Backlog / Todo / In Progress / Done; tarjetas con ID + labels + avatar; detalle de issue con activity stream

#### Cron

- **Background:** `#161412` (warm dark)
- **Primary accent:** `#FF4700`
- **Secondary:** `#392B0F` / accent gold `#FFAA00`
- **Base spacing:** **4px**; radius **3px**
- **Tipografía:** Helvetica Neue; display muy grande en marketing

#### Untitled UI

- **Primary:** `#7F56D9` / accent `#6941C6`
- **Text secondary:** `#525252` / ink `#101828`
- **Base spacing:** **4px**; radius **8px**
- **Tipografía:** Inter; body 18px marketing, components densos en app
- **IA de sistema:** tokens de color, spacing scale, table patterns, empty states documentados

#### Vercel

- **Background:** `#FAFAFA`; text `#171717`
- **Primary:** `#0072F5`
- **Base spacing:** **4px**; radius **6px**
- **Tipografía:** Geist Sans + Geist Mono
- **color-scheme:** `dark light` desde el primer render

#### Tremor

- **Uso:** componentes de charts (area/bar/line), KPI cards, tooltips
- **Colores UI:** ink `#101828`, accent blue `#2B7FFF`
- **Patrón:** métrica grande + delta % + sparkline embebido

---

## 2. Arquitectura de información (cómo organizan el producto)

### Patrón dominante (Attio + Linear + HubSpot moderno)

```
Shell
├── Sidebar (persistente, colapsable)
│   ├── Workspace switcher
│   ├── Primarios: Home / Pipeline / Clientes / Proyectos
│   ├── Secundarios: Facturación / Reportes
│   └── Footer: Settings / User
├── Topbar
│   ├── Breadcrumb / título de vista
│   ├── Search global (⌘K)
│   └── Acciones contextuales + avatar + status
└── Main
    ├── Metrics strip (Bento / KPI row)
    ├── Primary workspace (board | table | detail)
    └── Secondary folds (admin, system health)
```

### Mapeo para Luenio Agency CRM

| Módulo            | Analogía premium                 | Contenido principal                                          |
| ----------------- | -------------------------------- | ------------------------------------------------------------ |
| **Dashboard**     | Attio Home + Vercel overview     | Bento: MRR, pipeline value, leads activos, churn, tareas hoy |
| **Pipeline**      | Attio Deals board / Linear board | Kanban por stage + card con value/probability/owner          |
| **Clientes**      | Attio Companies table            | Data table filtrable + drawer de ficha                       |
| **Proyectos**     | Linear Projects                  | Timeline / status bars + budget                              |
| **Facturación**   | Stripe-like list                 | Invoice table + status badges + due dates                    |
| **Configuración** | Linear Settings                  | Users, stages, integrations                                  |

**Decisión:** navegación **sidebar + topbar** (no solo header plano). Dashboard = **Bento Grid**; Pipeline = **Kanban full-width**; Clientes/Facturas = **Data Table + drawer**.

---

## 3. Kanban board — patrones observados

### Linear / Attio

- Columnas con **header sticky**: nombre stage + contador + menú
- Cards compactas (56–72px min height): título, meta secundaria (owner avatar, amount, days in stage), badge de estado
- **Drag & drop** con ghost/placeholder y reorden por `position` float/int
- Empty column: estado vacío ilustrado (no solo texto “No items”)
- Filtros chip row encima del board (Todos / Caliente / Míos / Vencen hoy)
- Click en card → **panel lateral** (no modal full-screen) con ficha + acciones

### Decisiones Luenio

1. Stages fijos (enum DB): `nuevo → contactado → propuesta → negociacion → ganado | perdido`
2. Orden en columna: campo `position` (float) actualizado en drop
3. Card: nombre lead, empresa, value formateado COP/USD, probability %, owner avatar, expected_close_date
4. DnD: HTML5 o Pointer Events + optimistic UI; persistencia vía server action
5. Column empty state con CTA “Añadir lead”
6. Loading: skeleton de columnas (no spinner centrado)

---

## 4. Data tables — patrones

### Untitled UI + Attio Companies

- Header con search + filtros + bulk actions
- Columnas ordenables (click header)
- Filas con hover sutil (`surface-2`), selection checkbox
- Badges de status con color semántico (no solo gris)
- Paginación o infinite scroll al pie
- Densidad: 40–48px row height; tipografía 13–14px body
- Empty state ilustrado + primary CTA

### Decisiones Luenio

- `ClientTable` / `InvoiceList`: columns sticky name, status badge, amount, owner, dates
- Filtros: status multi-select + date range + owner
- Sort server-side (SQL `ORDER BY`)
- Page size 25; pagination controls al pie
- Row click → detail drawer

---

## 5. Paleta, gradientes, glass / neumo

| Referencia | Enfoque                                                   | Adoptar                                                          |
| ---------- | --------------------------------------------------------- | ---------------------------------------------------------------- |
| Linear     | Near-black surfaces, borders 1px sutiles, casi sin sombra | Dark mode tokens + hairline borders                              |
| Attio      | White cards, soft gray borders, radius 8–10               | Light mode “oficina limpia”                                      |
| Cron       | Warm dark + acento naranja                                | **No** copiar naranja; Luenio mantiene acento navy/teal de marca |
| Vercel     | `#FAFAFA` canvas, white cards, radius 6                   | Canvas off-white, no pure `#fff` full-bleed                      |
| Glass      | Poco en CRMs productivos                                  | Evitar glassmorphism pesado en data views                        |
| Neumo      | No aparece en referencias premium 2024–26                 | **Prohibido**                                                    |

### Decisiones de color Luenio (alineadas a Figma + research)

Ver `styles/design-tokens.ts` (extraídos de Figma file `Bx0I3QJCW0YEQegrX35Sw2` + refinados con patrones Attio/Linear).

Resumen:

- **Light canvas:** warm off-white (`#F4F3F0` familia)
- **Surface:** pure white cards
- **Accent primary:** deep navy (`#0F3D56`) — identidad Luenio, no purple Untitled
- **Semantic:** success green, warning amber, danger red, cold stone
- **Dark:** canvas `#0B0C0E`, surface `#141516`, text `#F7F8F8` (inspiración Linear)
- **Borders:** 1px solid token, no drop-shadow grises genéricos `#000/10`
- **Elevation:** 1 nivel de sombra sutil (Attio-style) o inset ring (Linear-style)

---

## 6. Gráficos financieros (MRR, churn, revenue)

### Tremor + Attio Reports + Vercel analytics

- **KPI card:** label uppercase small + valor grande tabular + delta badge (`+12.4%`) + sparkline 7–30d
- **MRR chart:** area chart suave (no bar chart ruidoso) con fill gradient de baja opacidad
- **Churn:** línea secundaria o stacked bar “new vs churned”
- **Composition:** Bento 2×2 o 1×4 en top del dashboard
- Tooltips: date + exact currency + comparison period
- Empty: “Sin snapshots aún” + CTA a importar/conectar billing

### Decisiones Luenio

- Tabla `metrics_snapshots` con `mrr`, `new_mrr`, `churned_mrr`, `active_clients_count` por `month`
- `MetricsGrid` (Bento): 4 KPIs + 1 area chart MRR 6 meses + 1 bar new vs churned
- Formato moneda: `Intl.NumberFormat` con currency de invoice
- Colores chart: accent primary stroke; success fill para new MRR; danger para churned

---

## 7. Micro-interacciones y estados (obligatorios)

| Estado         | Patrón premium                    | Implementación Luenio                                  |
| -------------- | --------------------------------- | ------------------------------------------------------ |
| Loading        | Skeleton shimmer (Linear)         | `.skeleton` con `background-size` animate, no spinners |
| Empty          | Ilustración simple + título + CTA | Componente `EmptyState` por módulo                     |
| Error          | Inline banner + retry             | `ErrorState` con mensaje y botón Reintentar            |
| Success        | Toast breve                       | Toast bottom-right, auto-dismiss 4s                    |
| Hover          | Lift sutil o bg `surface-2`       | Cards scale(1) → border accent / bg shift              |
| Focus          | Ring 2–3px accent soft            | `:focus-visible` outline token                         |
| Active / press | Scale 0.98 opacity                | Buttons `active:scale-[0.98]`                          |
| Stagger        | Entrada de listas                 | `animation-delay: calc(i * 40ms)`                      |
| Easing         | Custom cubic-bezier               | `--ease-out: cubic-bezier(0.16, 1, 0.3, 1)`            |

---

## 8. Decisiones de diseño ADOPTADAS (checklist accionable)

1. **Shell:** Sidebar 240px + Topbar 52–56px + main scroll independiente
2. **Dashboard:** Bento Grid 12-col (métricas, pipeline snapshot, facturas recientes, proyectos)
3. **Pipeline:** Kanban 6 columnas con DnD y panel de detalle
4. **Tablas:** densidad media, badges semánticos, filtros chips, paginación
5. **Tokens:** archivo único `styles/design-tokens.ts` + CSS variables light/dark
6. **Tipografía:** Inter (400/500/600/700), escala modular 11 / 12 / 13 / 14 / 16 / 20 / 24 / 32
7. **Spacing:** base 4px; preferir 8/12/16/24/32
8. **Radius:** 6px controls, 8px cards, 999px pills/badges
9. **Sombras:** una sola elevación sutil; preferir border hairline
10. **Sin** Bootstrap default, **sin** shadcn sin theming, **sin** mock arrays en UI
11. **Datos:** Neon Postgres (schema versionado) + queries reales
12. **Motion:** stagger + ease custom + button press feedback

---

## 9. Anti-patrones a evitar (vistos en CRMs mediocres)

- Cards blancas con `box-shadow: 0 4px 24px rgba(0,0,0,0.1)` genérico
- Spinners únicos en centro de página sin skeleton de layout
- Empty states “No data” sin CTA
- Sidebar con iconos genéricos y 12 items del mismo peso visual
- Gradientes llamativos en data surfaces
- Hardcode de colores hex fuera del token system

---

## 10. Tokens Figma extraídos (Fase 2 — completada)

Archivo: https://www.figma.com/design/Bx0I3QJCW0YEQegrX35Sw2  
Frame: `CRM Desktop 1280 — Luenio` (`2:2`)  
Código: `styles/design-tokens.ts` + `styles/globals.css`

| Token                      | Valor Figma (exacto)                |
| -------------------------- | ----------------------------------- |
| Canvas                     | `#080d16`                           |
| Surface                    | `#0e1524`                           |
| Surface deep               | `#0a101c`                           |
| Surface raised             | `#131c2e`                           |
| Text primary               | `#f1f5f9`                           |
| Text secondary             | `#7c8aa0`                           |
| Accent (copper)            | `#d4a574`                           |
| Border                     | `rgba(140,153,173,0.15–0.28)`       |
| Success / Warning / Danger | `#34d399` / `#fbbf24` / `#f87171`   |
| Radii                      | 5 / 6 / 7 / 8 / 10 / 999            |
| Font                       | Inter 400–700, sizes 9–22           |
| Shadows                    | ninguna en frame (hairline borders) |

Light mode: canvas `#f4f3f0`, accent navy `#0f3d56` (research Attio/Vercel + marca Luenio).

## 11. Fase 3 — estado

- Estructura modular: `components/{ui,layout,modules}`, `lib/{db,api}`, `styles/`, `db/{migrations,seeds}`
- Schema Neon documentado: `docs/schema.md`
- Migración + seed SQL listos
- API: `/api/crm/*` cableada en router
- **Acción usuario:** completar `npm run db:neon:auth` en navegador (OAuth 60s), luego `db:neon:create` + set `DATABASE_URL` + `db:migrate --seed`
