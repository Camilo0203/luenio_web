// impeccable-disable overused-font -- Inter es la familia operativa global aprobada en DESIGN.md.
let scheduled = false;

function appendInterStylesheet() {
  if (typeof document === "undefined") return;
  if (document.getElementById("luenio-font-inter")) return;

  if (!document.getElementById("luenio-fonts-preconnect")) {
    const preconnectGoogle = document.createElement("link");
    preconnectGoogle.id = "luenio-fonts-preconnect";
    preconnectGoogle.rel = "preconnect";
    preconnectGoogle.href = "https://fonts.googleapis.com";

    const preconnectGstatic = document.createElement("link");
    preconnectGstatic.rel = "preconnect";
    preconnectGstatic.href = "https://fonts.gstatic.com";
    preconnectGstatic.crossOrigin = "anonymous";
    document.head.append(preconnectGoogle, preconnectGstatic);
  }

  const stylesheet = document.createElement("link");
  stylesheet.id = "luenio-font-inter";
  stylesheet.rel = "stylesheet";
  stylesheet.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400..800&display=optional";

  document.head.append(stylesheet);
}

/** Load Inter after critical UI work. Safe to call multiple times. */
export function loadInterFonts() {
  if (typeof document === "undefined" || scheduled) return;
  if (navigator.connection?.saveData) return;
  scheduled = true;

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(appendInterStylesheet, { timeout: 1500 });
    return;
  }

  window.setTimeout(appendInterStylesheet, 0);
}
