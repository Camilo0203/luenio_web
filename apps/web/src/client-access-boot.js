/**
 * Synchronous boot (non-module) — set data-signed-in from UI hint cookie
 * before paint so labels don't flash "Acceso clientes" → "Mi espacio".
 * Real security is always the HttpOnly session cookie + server checks.
 */
(function bootClientAccessHint() {
  try {
    const signedIn = /(?:^|;\s*)luenio_signed_in=1(?:;|$)/.test(document.cookie || "");
    if (signedIn) document.documentElement.dataset.signedIn = "1";
    else delete document.documentElement.dataset.signedIn;
  } catch {
    /* ignore */
  }
})();
