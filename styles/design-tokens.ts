/**
 * Luenio CRM — Design Tokens
 * Source of truth extracted from Figma file Bx0I3QJCW0YEQegrX35Sw2
 * Frame: "CRM Desktop 1280 — Luenio" (node 2:2)
 * Plus light-mode system from research (Attio/Vercel) + existing admin-light brand.
 *
 * DO NOT hardcode colors/radii/type outside this module or the CSS variables it emits.
 */

export const FIGMA_FILE_KEY = "Bx0I3QJCW0YEQegrX35Sw2" as const;
export const FIGMA_FRAME_ID = "2:2" as const;

/** Exact paints read from Figma nodes (dark desktop frame). */
export const figmaExtracted = {
  canvas: "#080d16",
  surface: "#0e1524",
  surfaceDeep: "#0a101c",
  surfaceRaised: "#131c2e",
  textPrimary: "#f1f5f9",
  textSecondary: "#7c8aa0",
  textMuted: "#8c99ad",
  accent: "#d4a574",
  accentSoft: "rgba(212, 165, 116, 0.10)",
  accentSoftStrong: "rgba(212, 165, 116, 0.12)",
  accentBorder: "rgba(212, 165, 116, 0.28)",
  border: "rgba(140, 153, 173, 0.15)",
  borderStrong: "rgba(140, 153, 173, 0.20)",
  borderControl: "rgba(140, 153, 173, 0.28)",
  success: "#34d399",
  warning: "#fbbf24",
  danger: "#f87171",
  warm: "#fb923c",
  cold: "#94a3b8",
  white: "#ffffff",
  primaryButtonText: "#080d16",
  radii: {
    none: 0,
    sm: 5,
    control: 6,
    cardInner: 7,
    card: 8,
    panel: 10,
    pill: 999,
  },
  spacing: [2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 14, 20, 28] as const,
  fontFamily: "Inter",
  fontWeights: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  fontSizes: {
    label: 9,
    caption: 10,
    meta: 11,
    body: 12,
    bodyMd: 13,
    bodyLg: 14,
    title: 15,
    titleLg: 16,
    display: 18,
    kpi: 22,
  },
  layout: {
    frameWidth: 1280,
    headerHeight: 52,
    pagePaddingX: 20,
    pagePaddingTop: 14,
    pagePaddingBottom: 28,
    sectionGap: 10,
    cardPadding: 14,
    cardPaddingY: 12,
    buttonHeight: 31,
    buttonPaddingX: 12,
    buttonPaddingY: 8,
    sidebarIdeal: 240,
    detailPanel: 320,
  },
  shadows: [] as const, // Figma frame uses hairline borders, no drop shadows
} as const;

/** Light mode — research (Attio/Vercel) + Luenio brand navy (not copper-only). */
export const lightTheme = {
  canvas: "#f4f3f0",
  surface: "#ffffff",
  surface2: "#faf9f7",
  surfaceDeep: "#f1efeb",
  textPrimary: "#1c1917",
  textSecondary: "#44403c",
  textMuted: "#78716c",
  accent: "#0f3d56",
  accentSoft: "#e8f1f6",
  accentBorder: "rgba(15, 61, 86, 0.18)",
  border: "#e7e5e4",
  borderStrong: "#d6d3d1",
  borderControl: "#a8a29e",
  success: "#15803d",
  successSoft: "#f0fdf4",
  warning: "#b45309",
  warningSoft: "#fffbeb",
  danger: "#b91c1c",
  dangerSoft: "#fef2f2",
  warm: "#c2410c",
  warmSoft: "#fff7ed",
  cold: "#57534e",
  coldSoft: "#f5f5f4",
  focusRing: "rgba(15, 61, 86, 0.12)",
  shadow: "0 1px 2px rgba(28, 25, 23, 0.05)",
  shadowMd: "0 4px 12px rgba(28, 25, 23, 0.06)",
} as const;

/** Dark mode — exact Figma CRM frame mapping. */
export const darkTheme = {
  canvas: figmaExtracted.canvas,
  surface: figmaExtracted.surface,
  surface2: figmaExtracted.surfaceRaised,
  surfaceDeep: figmaExtracted.surfaceDeep,
  textPrimary: figmaExtracted.textPrimary,
  textSecondary: figmaExtracted.textSecondary,
  textMuted: figmaExtracted.textMuted,
  accent: figmaExtracted.accent,
  accentSoft: figmaExtracted.accentSoft,
  accentBorder: figmaExtracted.accentBorder,
  border: figmaExtracted.border,
  borderStrong: figmaExtracted.borderStrong,
  borderControl: figmaExtracted.borderControl,
  success: figmaExtracted.success,
  successSoft: "rgba(52, 211, 153, 0.12)",
  warning: figmaExtracted.warning,
  warningSoft: "rgba(251, 191, 36, 0.12)",
  danger: figmaExtracted.danger,
  dangerSoft: "rgba(248, 113, 113, 0.12)",
  warm: figmaExtracted.warm,
  warmSoft: "rgba(251, 146, 60, 0.12)",
  cold: figmaExtracted.cold,
  coldSoft: "rgba(148, 163, 184, 0.12)",
  focusRing: "rgba(212, 165, 116, 0.20)",
  shadow: "none",
  shadowMd: "0 0 0 1px rgba(140, 153, 173, 0.12)",
} as const;

export const radii = {
  none: "0px",
  sm: `${figmaExtracted.radii.sm}px`,
  control: `${figmaExtracted.radii.control}px`,
  cardInner: `${figmaExtracted.radii.cardInner}px`,
  card: `${figmaExtracted.radii.card}px`,
  panel: `${figmaExtracted.radii.panel}px`,
  pill: `${figmaExtracted.radii.pill}px`,
} as const;

/** 4px modular scale (research + Figma spacings). */
export const space = {
  0: "0px",
  0.5: "2px",
  1: "4px",
  1.5: "6px",
  2: "8px",
  2.5: "10px",
  3: "12px",
  3.5: "14px",
  4: "16px",
  5: "20px",
  6: "24px",
  7: "28px",
  8: "32px",
  10: "40px",
  12: "48px",
  16: "64px",
} as const;

export const typography = {
  fontFamily: {
    sans: `'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif`,
    mono: `'Geist Mono', ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace`,
  },
  weight: {
    regular: String(figmaExtracted.fontWeights.regular),
    medium: String(figmaExtracted.fontWeights.medium),
    semibold: String(figmaExtracted.fontWeights.semibold),
    bold: String(figmaExtracted.fontWeights.bold),
  },
  size: {
    label: "0.5625rem",
    caption: "0.625rem",
    meta: "0.6875rem",
    body: "0.75rem",
    bodyMd: "0.8125rem",
    bodyLg: "0.875rem",
    title: "0.9375rem",
    titleLg: "1rem",
    h3: "1.25rem",
    h2: "1.5rem",
    h1: "2rem",
    display: "1.125rem",
    kpi: "1.375rem",
  },
  lineHeight: {
    tight: "1.15",
    snug: "1.3",
    normal: "1.5",
  },
  letterSpacing: {
    tight: "-0.02em",
    normal: "0",
    wide: "0.04em",
    caps: "0.08em",
  },
} as const;

/** Persuade typography stays separate from the denser Operate scale. */
export const publicTypography = {
  display: "clamp(3.25rem, 7vw, 6rem)",
  headline: "clamp(2.4rem, 4.5vw, 4.8rem)",
  title: "clamp(1.2rem, 2vw, 1.65rem)",
  body: "1rem",
  label: "0.75rem",
  lineHeight: {
    display: "0.98",
    headline: "1.02",
    title: "1.18",
    body: "1.65",
  },
} as const;

/** Cross-surface dimensions that carry the same intent in Persuade and Operate. */
export const sharedLayout = {
  publicContainer: "1200px",
  touchTarget: "44px",
  publicControlHeight: "52px",
} as const;

export const motion = {
  duration: {
    instant: "80ms",
    fast: "140ms",
    normal: "220ms",
    slow: "360ms",
  },
  ease: {
    /** Premium out — not flat ease-in-out */
    out: "cubic-bezier(0.16, 1, 0.3, 1)",
    inOut: "cubic-bezier(0.65, 0, 0.35, 1)",
    spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
  },
  stagger: {
    list: 40,
    cards: 50,
  },
} as const;

export const zIndex = {
  base: 0,
  sticky: 10,
  dropdown: 30,
  drawer: 40,
  modal: 50,
  toast: 60,
  tooltip: 70,
} as const;

/**
 * CSS custom properties for light + dark.
 * Apply `[data-theme="light"]` / `[data-theme="dark"]` on <html> or body.
 */
export function tokensToCssVariables(): string {
  const map = (theme: typeof lightTheme | typeof darkTheme) =>
    Object.entries({
      "--color-canvas": theme.canvas,
      "--color-surface": theme.surface,
      "--color-surface-2": theme.surface2,
      "--color-surface-deep": theme.surfaceDeep,
      "--color-text": theme.textPrimary,
      "--color-text-2": theme.textSecondary,
      "--color-mute": theme.textMuted,
      "--color-accent": theme.accent,
      "--color-accent-soft": theme.accentSoft,
      "--color-accent-border": theme.accentBorder,
      "--color-border": theme.border,
      "--color-border-strong": theme.borderStrong,
      "--color-border-control": theme.borderControl,
      "--color-success": theme.success,
      "--color-success-soft": theme.successSoft,
      "--color-warning": theme.warning,
      "--color-warning-soft": theme.warningSoft,
      "--color-danger": theme.danger,
      "--color-danger-soft": theme.dangerSoft,
      "--color-warm": theme.warm,
      "--color-warm-soft": theme.warmSoft,
      "--color-cold": theme.cold,
      "--color-cold-soft": theme.coldSoft,
      "--color-focus-ring": theme.focusRing,
      "--shadow-sm": theme.shadow,
      "--shadow-md": theme.shadowMd,
    })
      .map(([k, v]) => `  ${k}: ${v};`)
      .join("\n");

  return `:root, [data-theme="light"] {
${map(lightTheme)}
  color-scheme: light;
}

[data-theme="dark"] {
${map(darkTheme)}
  color-scheme: dark;
}

:root {
  --font-sans: ${typography.fontFamily.sans};
  --font-mono: ${typography.fontFamily.mono};
  --radius-sm: ${radii.sm};
  --radius-control: ${radii.control};
  --radius-card: ${radii.card};
  --radius-panel: ${radii.panel};
  --radius-pill: ${radii.pill};
  --space-1: ${space[1]};
  --space-2: ${space[2]};
  --space-3: ${space[3]};
  --space-4: ${space[4]};
  --space-5: ${space[5]};
  --space-6: ${space[6]};
  --space-8: ${space[8]};
  --ease-out: ${motion.ease.out};
  --ease-in-out: ${motion.ease.inOut};
  --duration-fast: ${motion.duration.fast};
  --duration-normal: ${motion.duration.normal};
  --z-modal: ${zIndex.modal};
  --z-toast: ${zIndex.toast};
  --text-label: ${typography.size.label};
  --text-caption: ${typography.size.caption};
  --text-meta: ${typography.size.meta};
  --text-body: ${typography.size.body};
  --text-body-md: ${typography.size.bodyMd};
  --text-body-lg: ${typography.size.bodyLg};
  --text-title: ${typography.size.title};
  --text-title-lg: ${typography.size.titleLg};
  --text-h3: ${typography.size.h3};
  --text-h2: ${typography.size.h2};
  --text-h1: ${typography.size.h1};
  --text-kpi: ${typography.size.kpi};
  --font-weight-regular: ${typography.weight.regular};
  --font-weight-medium: ${typography.weight.medium};
  --font-weight-semibold: ${typography.weight.semibold};
  --font-weight-bold: ${typography.weight.bold};
}
`;
}

export type ThemeMode = "light" | "dark";

export const designTokens = {
  figma: figmaExtracted,
  light: lightTheme,
  dark: darkTheme,
  radii,
  space,
  typography,
  publicTypography,
  sharedLayout,
  motion,
  zIndex,
} as const;

export default designTokens;
