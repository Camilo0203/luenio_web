/**
 * The published guides, declared once.
 *
 * A guide is a long-form answer to a question prospects actually type into a
 * search engine. It exists so the site has an indexable surface beyond the
 * landings: the landings sell, the guides get found and quoted.
 *
 * `dir` names the page directory (`apps/web/pages/guides/<dir>/`) and the Vite
 * entry. `slug` is the public path segment (`/guias/<slug>`) and is what the
 * sitemap and every internal link use. They are kept separate for the same
 * reason the sectors keep an English id beside a Spanish slug: the directory is
 * code, the slug is copy.
 *
 * `published` is the ISO date in the page's `datePublished`. Keep the two in
 * sync — the architecture test does not read the HTML.
 */

export const GUIDES = Object.freeze([
  Object.freeze({
    dir: "whatsapp-business-api",
    slug: "whatsapp-business-api",
    title: "WhatsApp Business y WhatsApp Business API: cuál necesita tu negocio",
    summary:
      "Las tres formas de usar WhatsApp en un negocio, qué gana y qué pierde cada una, y cuándo la API deja de ser opcional.",
    published: "2026-09-10",
  }),
  Object.freeze({
    dir: "chatbot-whatsapp",
    slug: "chatbot-whatsapp",
    title: "Chatbot de WhatsApp para negocios: qué resuelve y qué no",
    summary:
      "Lo que un asistente automático hace bien, lo que no debería intentar, y las reglas que evitan que espante clientes.",
    published: "2026-09-10",
  }),
  Object.freeze({
    dir: "conectar-web-con-whatsapp",
    slug: "conectar-web-con-whatsapp",
    title: "Cómo conectar tu página web con WhatsApp sin perder el rastro del cliente",
    summary:
      "Por qué el botón de WhatsApp borra el origen de cada conversación y cómo montar el puente para que no ocurra.",
    published: "2026-09-10",
  }),
]);

/** Canonical public path of a guide, e.g. `/guias/chatbot-whatsapp`. */
export function guidePath(guide) {
  return `/guias/${guide.slug}`;
}
