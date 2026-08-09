/**
 * Animated skeleton placeholders — never use generic spinners as primary loading.
 */

export function createSkeleton({
  width = "100%",
  height = "16px",
  radius = "var(--radius-control)",
  className = "",
} = {}) {
  const el = document.createElement("div");
  el.className = ["skeleton", "ui-skeleton", className].filter(Boolean).join(" ");
  el.style.width = width;
  el.style.height = height;
  el.style.borderRadius = radius;
  el.setAttribute("aria-hidden", "true");
  return el;
}

export function createCardSkeleton() {
  const card = document.createElement("div");
  card.className = "ui-skeleton-card ui-surface ui-surface--panel";
  card.append(
    createSkeleton({ width: "40%", height: "10px" }),
    createSkeleton({ width: "70%", height: "18px" }),
    createSkeleton({ width: "55%", height: "12px" }),
  );
  return card;
}

export function createMetricsSkeleton(count = 4) {
  const grid = document.createElement("div");
  grid.className = "bento-grid";
  for (let i = 0; i < count; i++) {
    const cell = document.createElement("div");
    cell.className = "bento-span-3 ui-skeleton-metric ui-surface ui-surface--card";
    cell.append(
      createSkeleton({ width: "48%", height: "10px" }),
      createSkeleton({ width: "36%", height: "22px" }),
    );
    grid.append(cell);
  }
  return grid;
}

export const skeletonStyles = `
.ui-skeleton-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
}
.ui-skeleton-metric {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px;
  min-height: 62px;
}
`;
