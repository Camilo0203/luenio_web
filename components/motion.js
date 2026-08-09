const MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const EASE_OUT = "cubic-bezier(0.16, 1, 0.3, 1)";

export function motionAllowed() {
  return (
    typeof window !== "undefined" &&
    typeof Element !== "undefined" &&
    !window.matchMedia(MOTION_QUERY).matches
  );
}

function play(element, keyframes, options) {
  if (!motionAllowed() || !(element instanceof Element) || !element.animate) return null;
  return element.animate(keyframes, {
    easing: EASE_OUT,
    fill: "none",
    ...options,
  });
}

export function animateLedgerTransition(element, direction = 1) {
  const edge = direction > 0 ? "inset(0 0 0 14px)" : "inset(0 14px 0 0)";
  return play(
    element,
    [
      {
        clipPath: edge,
        opacity: 0.76,
        transform: `translateX(${direction * 10}px)`,
        filter: "saturate(0.72)",
      },
      {
        clipPath: "inset(0)",
        opacity: 1,
        transform: "translateX(0)",
        filter: "saturate(1)",
      },
    ],
    { duration: 280 },
  );
}

export function animateResolvedBars(root, selector, { axis = "y", variable } = {}) {
  if (!motionAllowed() || !(root instanceof Element)) return;
  requestAnimationFrame(() => {
    [...root.querySelectorAll(selector)].forEach((element, index) => {
      const target = Number.parseFloat(getComputedStyle(element).getPropertyValue(variable)) || 0;
      const scale = axis === "x" ? `scaleX(${target})` : `scaleY(${target})`;
      const origin = axis === "x" ? "left center" : "center bottom";
      play(
        element,
        [
          {
            transform: axis === "x" ? "scaleX(0.04)" : "scaleY(0.04)",
            transformOrigin: origin,
            opacity: 0.48,
            clipPath: axis === "x" ? "inset(0 96% 0 0)" : "inset(96% 0 0 0)",
          },
          {
            transform: scale,
            transformOrigin: origin,
            opacity: 1,
            clipPath: "inset(0)",
          },
        ],
        {
          duration: 320,
          delay: Math.min(index * 28, 168),
        },
      );
    });
  });
}

export function animateStateSignal(element, active) {
  return play(
    element,
    active
      ? [
          { transform: "scale(0.68)", boxShadow: "0 0 0 0 rgba(21, 128, 61, 0.28)" },
          { transform: "scale(1)", boxShadow: "0 0 0 7px rgba(21, 128, 61, 0)" },
        ]
      : [
          { transform: "scale(1)", opacity: 1 },
          { transform: "scale(0.72)", opacity: 0.45 },
          { transform: "scale(1)", opacity: 1 },
        ],
    { duration: active ? 360 : 220 },
  );
}

export function animateSelection(element, direction = 1) {
  const edge = direction > 0 ? "inset(0 100% 0 0)" : "inset(0 0 0 100%)";
  return play(
    element,
    [
      { clipPath: edge, opacity: 0.62 },
      { clipPath: "inset(0)", opacity: 1 },
    ],
    { duration: 220 },
  );
}
