import { animateSelection } from "../motion.js";

const NAV = [
  { id: "dashboard", label: "Inicio", href: "#/dashboard", icon: "▣" },
  { id: "pipeline", label: "Pipeline", href: "#/pipeline", icon: "▦" },
  { id: "clientes", label: "Clientes", href: "#/clientes", icon: "◎" },
  { id: "proyectos", label: "Proyectos", href: "#/proyectos", icon: "▤" },
  { id: "facturacion", label: "Facturación", href: "#/facturacion", icon: "◈" },
  { id: "configuracion", label: "Equipo", href: "#/configuracion", icon: "⚙" },
];

function rememberWorkspace(id) {
  try {
    localStorage.setItem("luenio-workspace", id);
  } catch {
    /* ignore */
  }
}

/**
 * @param {{ active?: string, brand?: string, onNavigate?: (id: string) => void }} opts
 */
export function createSidebar({ active = "dashboard", brand = "Luenio", onNavigate } = {}) {
  const aside = document.createElement("aside");
  aside.className = "crm-sidebar";
  aside.setAttribute("aria-label", "Navegación principal");

  const logo = document.createElement("a");
  logo.className = "crm-sidebar__brand";
  logo.href = "/app";
  logo.setAttribute("aria-label", "Volver a espacios Luenio");
  logo.innerHTML = `
    <span class="crm-sidebar__mark" aria-hidden="true">L</span>
    <div>
      <div class="crm-sidebar__name">${brand}</div>
      <div class="crm-sidebar__sub">Agencia · cartera</div>
    </div>
  `;

  // Product switcher (same mental model as Leads header)
  const switcher = document.createElement("nav");
  switcher.className = "crm-switcher";
  switcher.setAttribute("aria-label", "Espacios de trabajo");
  switcher.innerHTML = `
    <a class="crm-switcher__link" href="/app">Espacios</a>
    <a class="crm-switcher__link" href="/dashboard" data-workspace="leads">Leads</a>
    <a class="crm-switcher__link is-active" href="/crm" data-workspace="crm" aria-current="page">Agencia</a>
  `;
  switcher.querySelectorAll("[data-workspace]").forEach((el) => {
    el.addEventListener("click", () => rememberWorkspace(el.getAttribute("data-workspace")));
  });
  rememberWorkspace("crm");

  const nav = document.createElement("nav");
  nav.className = "crm-sidebar__nav";

  const activate = (id, withMotion = true) => {
    const links = [...nav.querySelectorAll(".crm-sidebar__link")];
    const previous = links.findIndex((element) => element.classList.contains("is-active"));
    const next = links.findIndex((element) => element.dataset.nav === id);
    links.forEach((element, index) => element.classList.toggle("is-active", index === next));
    if (withMotion && next >= 0 && next !== previous) {
      animateSelection(links[next], next >= previous ? 1 : -1);
    }
  };

  for (const item of NAV) {
    const a = document.createElement("a");
    a.href = item.href;
    a.dataset.nav = item.id;
    a.className = "crm-sidebar__link" + (item.id === active ? " is-active" : "");
    a.innerHTML = `<span class="crm-sidebar__icon" aria-hidden="true">${item.icon}</span><span>${item.label}</span>`;
    a.addEventListener("click", (e) => {
      e.preventDefault();
      activate(item.id);
      onNavigate?.(item.id);
      if (location.hash !== item.href) location.hash = item.href.slice(1);
    });
    nav.append(a);
  }

  aside.append(logo, switcher, nav);
  aside.setActive = (id) => {
    activate(id);
  };

  return aside;
}

export const sidebarStyles = `
.crm-sidebar {
  width: 240px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: 16px 12px;
  background: var(--color-surface);
  border-right: 1px solid var(--color-border);
  min-height: 100vh;
}
.crm-sidebar__brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 8px 12px;
  text-decoration: none;
  color: inherit;
  border-radius: 8px;
}
.crm-sidebar__brand:hover {
  background: var(--color-surface-2, var(--color-surface-deep));
}
.crm-switcher {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin: 0 4px 10px;
  padding: 4px;
  border-radius: 10px;
  background: var(--color-surface-deep, var(--color-surface-2));
  border: 1px solid var(--color-border);
}
.crm-switcher__link {
  flex: 1 1 auto;
  text-align: center;
  padding: 6px 8px;
  border-radius: var(--radius-control);
  font-size: var(--text-meta);
  font-weight: 600;
  color: var(--color-text-2);
  text-decoration: none;
  letter-spacing: 0.02em;
}
.crm-switcher__link:hover {
  color: var(--color-text);
  background: var(--color-surface);
}
.crm-switcher__link.is-active {
  background: var(--color-surface);
  color: var(--color-accent);
  box-shadow: 0 1px 2px rgba(0,0,0,0.04);
}
.crm-sidebar__mark {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border-radius: var(--radius-control);
  background: var(--color-accent);
  color: var(--color-canvas);
  font-weight: var(--font-weight-bold);
  font-size: 13px;
}
.crm-sidebar__name {
  font-size: var(--text-body-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
  line-height: 1.2;
}
.crm-sidebar__sub {
  font-size: var(--text-caption);
  color: var(--color-mute);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.crm-sidebar__nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.crm-sidebar__link {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  border-radius: var(--radius-control);
  color: var(--color-text-2);
  text-decoration: none;
  font-size: var(--text-body-md);
  font-weight: var(--font-weight-medium);
  transition:
    background var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out);
}
.crm-sidebar__link:hover {
  background: var(--color-surface-2);
  color: var(--color-text);
}
.crm-sidebar__link.is-active {
  background: var(--color-accent-soft);
  color: var(--color-accent);
  font-weight: var(--font-weight-semibold);
}
.crm-sidebar__icon {
  width: 18px;
  text-align: center;
  opacity: 0.85;
}
@media (pointer: coarse) {
  .crm-switcher__link,
  .crm-sidebar__link {
    min-height: 44px;
  }
}
@media (max-width: 860px) {
  .crm-sidebar { width: 64px; padding: 12px 8px; }
  .crm-sidebar__name, .crm-sidebar__sub, .crm-sidebar__link span:last-child { display: none; }
  .crm-sidebar__brand { justify-content: center; padding: 4px; }
  .crm-sidebar__link { justify-content: center; }
}
`;
