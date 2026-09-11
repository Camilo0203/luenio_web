// Revelado al desplazar para las demos sectoriales.
//
// El estado inicial oculto vive detrás de `data-motion="on"`, que solo se
// declara aquí: sin JavaScript, o con movimiento reducido, la hoja nunca
// esconde nada y la página se lee entera. Es la única forma de que un fallo de
// carga no deje la mitad del contenido en opacidad cero.
//
// Se dispara una vez por elemento. Volver a animar cada vez que algo cruza el
// borde es una página peleándose con quien la lee.

const reduced = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)");

function start() {
  const targets = [...document.querySelectorAll("[data-reveal]")];
  if (targets.length === 0) return;

  document.documentElement.dataset.motion = "on";

  if (typeof IntersectionObserver !== "function") {
    for (const el of targets) el.dataset.visible = "";
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.dataset.visible = "";
        observer.unobserve(entry.target);
      }
    },
    // Un poco antes del borde inferior: el bloque ya está entrando cuando
    // empieza a moverse, en vez de aparecer de golpe bajo el pulgar.
    { rootMargin: "0px 0px -12% 0px", threshold: 0.08 },
  );

  for (const el of targets) observer.observe(el);
}

if (!reduced || !reduced.matches) start();

// Si alguien activa o desactiva el ajuste con la página abierta, se respeta sin
// recargar: al reducir, se descubre todo lo que quedara pendiente.
reduced?.addEventListener?.("change", (event) => {
  if (event.matches) {
    delete document.documentElement.dataset.motion;
    for (const el of document.querySelectorAll("[data-reveal]")) el.dataset.visible = "";
  } else {
    start();
  }
});
