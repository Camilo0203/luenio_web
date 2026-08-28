// Shared accessibility helpers for the public site.

// Anchor clicks must move focus, not just the viewport, or the skip link and the
// in-page navigation leave keyboard and screen reader users behind (WCAG 2.4.1).
// Section landmarks are not focusable, so borrow tabindex for the duration of the
// visit and hand it back on blur to keep them out of the tab order.
export function focusAnchorTarget(target) {
  if (!target) return;
  if (!target.hasAttribute("tabindex")) {
    target.setAttribute("tabindex", "-1");
    target.addEventListener("blur", () => target.removeAttribute("tabindex"), { once: true });
  }
  target.focus({ preventScroll: true });
}
