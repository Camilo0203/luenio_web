const THEME_STORAGE_KEY = "luenio-theme";

const themeControlMarkup = `
  <span class="theme-control__track" aria-hidden="true">
    <svg class="theme-control__sun" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="3.25"></circle>
      <path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"></path>
    </svg>
    <svg class="theme-control__moon" viewBox="0 0 24 24">
      <path d="M20 15.2A8.2 8.2 0 0 1 8.8 4a8.25 8.25 0 1 0 11.2 11.2Z"></path>
    </svg>
    <i></i>
  </span>`;

function resolveTheme() {
  const currentTheme = document.documentElement.dataset.theme;
  if (currentTheme === "dark" || currentTheme === "light") return currentTheme;

  try {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme === "dark" || savedTheme === "light") return savedTheme;
  } catch {
    // System preference remains available when storage is blocked.
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function updateThemeAssets() {
  const themeColor = document.querySelector('meta[name="theme-color"]');
  const styles = getComputedStyle(document.body);
  const pageColor = styles.getPropertyValue("--page").trim() || styles.backgroundColor;
  if (pageColor) themeColor?.setAttribute("content", pageColor);
}

function normalizeBrandMarks() {
  document.querySelectorAll(".brand-lockup img[src*='isotipo']").forEach((image) => {
    if (image.closest(".brand-mark__viewport")) return;

    const viewport = document.createElement("span");
    viewport.className = "brand-mark__viewport";
    const lightImage = image.cloneNode();
    image.classList.add("brand-mark__logo", "brand-mark__logo--primary");
    image.src = "/brand/isotipo.svg?v=202608";
    lightImage.classList.add("brand-mark__logo", "brand-mark__logo--light");
    lightImage.src = "/brand/isotipo-blanco.svg?v=202609";
    lightImage.alt = "";
    lightImage.setAttribute("aria-hidden", "true");
    image.before(viewport);
    viewport.append(image, lightImage);
  });
}

function syncControl(control, theme) {
  const isDark = theme === "dark";
  const label = isDark ? "Activar modo claro" : "Activar modo oscuro";
  control.setAttribute("aria-label", label);
  control.setAttribute("title", label);
  control.setAttribute("aria-pressed", String(isDark));
}

function placeControl(control) {
  const headerActions = document.querySelector(".site-header__actions");
  if (headerActions) {
    headerActions.append(control);
    return;
  }

  const menuToggle = document.querySelector("[data-menu-toggle]");
  if (menuToggle) {
    menuToggle.before(control);
    return;
  }

  const navigation = document.querySelector(".demo-nav, .site-nav");
  if (navigation) {
    control.classList.add("theme-control--floating");
    navigation.append(control);
    return;
  }

  control.classList.add("theme-control--floating");
  document.body.append(control);
}

export function initThemeControl() {
  if (document.querySelector("[data-theme-toggle]")) return;

  normalizeBrandMarks();
  // Legacy simulations are intentionally fixed sector worlds. A theme toggle would
  // change its label/state without changing their authored palette.
  if (document.body.matches(".simulation-page")) return;

  const control = document.createElement("button");
  control.className = "theme-control";
  control.type = "button";
  control.dataset.themeToggle = "";
  control.innerHTML = themeControlMarkup;
  placeControl(control);

  const applyTheme = (theme, persist = false) => {
    document.documentElement.dataset.theme = theme;
    syncControl(control, theme);
    updateThemeAssets();

    if (persist) {
      try {
        localStorage.setItem(THEME_STORAGE_KEY, theme);
      } catch {
        // The selected theme still applies for the current visit.
      }
    }
  };

  applyTheme(resolveTheme());
  control.addEventListener("click", () => {
    applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark", true);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initThemeControl, { once: true });
} else {
  initThemeControl();
}
