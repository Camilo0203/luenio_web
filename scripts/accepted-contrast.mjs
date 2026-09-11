/**
 * Excepciones de contraste aceptadas a mano, en un solo sitio.
 *
 * El botón de WhatsApp lleva letra blanca sobre el verde de marca por decisión
 * expresa de Camilo el 2026-09-11, tomada con la medida delante: 1,98 frente a
 * un mínimo de 4,5. Se le ofrecieron las combinaciones que sí cumplen con letra
 * blanca (`#075e54` da 7,67 y `#0d7a3f` da 5,42) y la tinta oscura sobre este
 * mismo verde, que daba 9,38. Eligió el verde de marca con letra blanca porque
 * es como se ve el botón de WhatsApp en todas partes.
 *
 * La lista vive aquí y no en cada test porque son dos los que miden contraste
 * —el audit de tema y la suite de navegador— y una lista duplicada se
 * desincroniza a la primera.
 *
 * La excepción es lo más estrecha que se puede escribir: estos controles, solo
 * contraste. Cualquier otro fallo de contraste en cualquier otra parte del
 * sitio sigue parando el gate.
 *
 * Antes de añadir nada aquí: el verde de WhatsApp es semántico y solo viste
 * controles que abren o continúan una conversación. Un botón que lleva a otro
 * sitio no entra en esta lista, se le cambia el color. Así se separó el
 * `gym-whatsapp-cta--quote`, que iba al formulario de cotización.
 */
export const ACCEPTED_CONTRAST_SELECTORS = [
  ".luenio-wa__trigger",
  ".luenio-wa__submit",
  ".wa-widget__trigger",
  ".wa-widget__submit",
  ".gym-whatsapp-cta",
];

export function isAcceptedContrast(target) {
  const text = Array.isArray(target) ? target.join(" ") : String(target);
  if (text.includes("--quote")) return false;
  return ACCEPTED_CONTRAST_SELECTORS.some((selector) => text.includes(selector));
}
