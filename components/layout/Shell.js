import { createSidebar } from "./Sidebar.js";
import { createTopbar } from "./Topbar.js";

/**
 * Application chrome: sidebar + topbar + main outlet.
 */
export function createShell({
  active = "dashboard",
  title = "Inicio",
  subtitle = "Agencia · cartera",
  userEmail = "",
  theme = "light",
  onNavigate,
  onThemeToggle,
  onRefresh,
} = {}) {
  const root = document.createElement("div");
  root.className = "crm-shell";

  const sidebar = createSidebar({ active, onNavigate });
  const mainCol = document.createElement("div");
  mainCol.className = "crm-shell__main";

  const topbar = createTopbar({
    title,
    subtitle,
    userEmail,
    theme,
    onThemeToggle,
    onRefresh,
  });

  const outlet = document.createElement("main");
  outlet.className = "crm-shell__outlet";
  outlet.id = "crm-outlet";
  outlet.setAttribute("role", "main");

  mainCol.append(topbar, outlet);
  root.append(sidebar, mainCol);

  return {
    root,
    sidebar,
    topbar,
    outlet,
    setView(id, viewTitle) {
      sidebar.setActive(id);
      topbar.setTitle(viewTitle || id);
    },
    setThemeLabel(mode) {
      topbar.setThemeLabel(mode);
    },
    setOnline(v) {
      topbar.setOnline(v);
    },
  };
}

export const shellStyles = `
.crm-shell {
  display: flex;
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--color-canvas);
  color: var(--color-text);
  font-family: var(--font-sans);
}
.crm-shell__main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.crm-shell__outlet {
  flex: 1;
  padding: 12px 16px 20px;
  overflow: auto;
}
.crm-sidebar {
  width: 220px;
}
.crm-sidebar__link {
  padding: 8px 10px;
  font-size: 13px;
}
.crm-view { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.crm-view__head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 8px 16px;
  padding-bottom: 4px;
}
.crm-view__kicker {
  margin: 0 0 2px;
  font-size: var(--text-caption);
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-text-2);
}
.crm-view__title {
  margin: 0;
  font-size: var(--text-h3);
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--color-text);
}
.crm-view__meta {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-2);
  font-variant-numeric: tabular-nums;
}
@media (max-width: 860px) {
  .crm-sidebar { width: 64px; }
  .crm-shell__outlet { padding: 10px 12px 16px; }
}
@media (max-width: 640px) {
  .crm-shell {
    flex-direction: column;
    width: 100%;
    max-width: 100vw;
    overflow-x: hidden;
  }
  .crm-sidebar {
    width: 100%;
    min-height: auto;
    position: sticky;
    top: 0;
    z-index: 10;
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    padding: max(10px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) 10px
      max(12px, env(safe-area-inset-left));
    border-right: 0;
    border-bottom: 1px solid var(--color-border);
  }
  .crm-sidebar__brand {
    min-height: 44px;
    justify-content: flex-start;
    padding: 4px;
  }
  .crm-sidebar__name,
  .crm-sidebar__sub,
  .crm-sidebar__link span:last-child {
    display: inline;
  }
  .crm-switcher {
    flex: 1 1 220px;
    margin: 0;
  }
  .crm-switcher__link {
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .crm-sidebar__nav {
    position: fixed;
    right: 0;
    bottom: 0;
    left: 0;
    z-index: 20;
    width: 100%;
    display: grid;
    grid-template-columns: repeat(6, minmax(44px, 1fr));
    gap: 2px;
    padding: 6px max(8px, env(safe-area-inset-right))
      max(6px, env(safe-area-inset-bottom)) max(8px, env(safe-area-inset-left));
    border-top: 1px solid var(--color-border);
    background: var(--color-surface);
    box-shadow: 0 -8px 24px rgba(8, 13, 22, 0.06);
  }
  .crm-sidebar__link {
    min-width: 0;
    min-height: 54px;
    flex-direction: column;
    justify-content: center;
    gap: 2px;
    padding: 5px 2px;
    font-size: clamp(8px, 2.4vw, var(--text-caption));
    text-align: center;
  }
  .crm-sidebar__link span:last-child {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .crm-shell__main {
    width: 100%;
  }
  .crm-shell__outlet {
    padding-bottom: calc(76px + env(safe-area-inset-bottom));
  }
}
`;
