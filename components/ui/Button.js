/**
 * Atomic Button — Figma radii/padding, press scale, focus ring from tokens.
 */

const VARIANTS = {
  primary: "ui-btn--primary",
  secondary: "ui-btn--secondary",
  ghost: "ui-btn--ghost",
  danger: "ui-btn--danger",
};

const SIZES = {
  sm: "ui-btn--sm",
  md: "ui-btn--md",
  lg: "ui-btn--lg",
};

/**
 * @param {object} props
 * @param {'primary'|'secondary'|'ghost'|'danger'} [props.variant]
 * @param {'sm'|'md'|'lg'} [props.size]
 * @param {boolean} [props.loading]
 * @param {boolean} [props.disabled]
 * @param {string} [props.className]
 * @param {string} [props.type]
 * @param {string|import('preact').ComponentChildren} props.children
 * @param {() => void} [props.onClick]
 */
export function buttonClassName({ variant = "primary", size = "md", className = "" } = {}) {
  return ["ui-btn", VARIANTS[variant] || VARIANTS.primary, SIZES[size] || SIZES.md, className]
    .filter(Boolean)
    .join(" ");
}

/**
 * Imperative HTML factory (vanilla JS admin stack).
 */
export function createButton({
  label,
  variant = "primary",
  size = "md",
  type = "button",
  disabled = false,
  loading = false,
  className = "",
  onClick,
  attrs = {},
} = {}) {
  const btn = document.createElement("button");
  btn.type = type;
  btn.className = buttonClassName({ variant, size, className });
  btn.disabled = disabled || loading;
  btn.textContent = loading ? "…" : label;
  if (loading) btn.setAttribute("aria-busy", "true");
  Object.entries(attrs).forEach(([k, v]) => btn.setAttribute(k, String(v)));
  if (onClick) btn.addEventListener("click", onClick);
  return btn;
}
