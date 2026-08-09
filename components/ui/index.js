/**
 * Inject module-specific UI styles once.
 * Atomic controls and surfaces live in styles/ui-primitives.css.
 */
import { skeletonStyles } from "./Skeleton.js";
import { emptyStateStyles } from "./EmptyState.js";
import { toastStyles } from "./Toast.js";
import { modalStyles } from "./Modal.js";
import { sidebarStyles } from "../layout/Sidebar.js";
import { topbarStyles } from "../layout/Topbar.js";
import { shellStyles } from "../layout/Shell.js";
import { metricsGridStyles } from "../modules/MetricsGrid.js";
import { kanbanStyles } from "../modules/KanbanBoard.js";
import { clientTableStyles } from "../modules/ClientTable.js";
import { invoiceListStyles } from "../modules/InvoiceList.js";
import { projectTimelineStyles } from "../modules/ProjectTimeline.js";
import { agencyCommandCenterStyles } from "../modules/AgencyCommandCenter.js";

const STYLE_ID = "luenio-crm-ui-styles";

export function injectCrmStyles() {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = [
    skeletonStyles,
    emptyStateStyles,
    toastStyles,
    modalStyles,
    sidebarStyles,
    topbarStyles,
    shellStyles,
    metricsGridStyles,
    kanbanStyles,
    clientTableStyles,
    invoiceListStyles,
    projectTimelineStyles,
    agencyCommandCenterStyles,
  ].join("\n");
  document.head.appendChild(style);
}

export { createButton, buttonClassName } from "./Button.js";
export { createBadge, toneForStatus } from "./Badge.js";
export { createSkeleton, createCardSkeleton, createMetricsSkeleton } from "./Skeleton.js";
export { createEmptyState } from "./EmptyState.js";
export { showToast } from "./Toast.js";
export { createInput } from "./Input.js";
export { openModal } from "./Modal.js";
export { createShell } from "../layout/Shell.js";
export { renderMetricsGrid } from "../modules/MetricsGrid.js";
export { renderKanbanBoard } from "../modules/KanbanBoard.js";
export { renderClientTable } from "../modules/ClientTable.js";
export { renderInvoiceList } from "../modules/InvoiceList.js";
export { renderProjectTimeline } from "../modules/ProjectTimeline.js";
export { renderAgencyCommandCenter } from "../modules/AgencyCommandCenter.js";
