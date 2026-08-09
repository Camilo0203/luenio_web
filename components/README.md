# Luenio shared components

This directory contains the reusable **Operate** UI used by authenticated CRM surfaces.
Import from the canonical entry point:

```js
import {
  createButton,
  createEmptyState,
  createInput,
  createShell,
  injectCrmStyles,
  openModal,
  showToast,
} from "../../components/index.js";
```

## Foundations

- `styles/design-tokens.css` owns brand primitives, typography scales, spacing, radii,
  touch targets, motion, and elevation.
- `styles/globals.css` maps those primitives to light and dark Operate semantics.
- `styles/ui-primitives.css` owns atomic buttons, fields, badges, and surfaces.
- Components may compose semantic tokens, but must not introduce a competing palette or
  type scale.

## Component responsibilities

- `ui/`: buttons, inputs, badges, loading, empty, toast, and modal states.
- `layout/`: shell, sidebar, and topbar composition.
- `modules/`: CRM-specific reusable views such as metrics, pipeline, clients, invoices,
  projects, and the agency command center.

Every interactive component must preserve keyboard focus, disabled/loading behavior,
accessible names, and recovery from empty or error states.

The five public sector demos are separate Persuade worlds. Their components, palettes,
and typography stay inside `apps/web`; only infrastructure-level tokens such as spacing,
touch targets, and motion may be shared with them.
