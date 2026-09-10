/**
 * The commercial service pages, declared once.
 *
 * The seven sector landings under `/gimnasios`, `/restaurantes` and friends are
 * simulations: their copy belongs to a fictional business — Titan Fitness Club,
 * Sabor & Fuego — and their `h1` is that business's headline, not ours. They
 * prove what we build; they do not sell it, and no amount of retitling makes a
 * gym's homepage read as an agency's offer.
 *
 * These pages fill that gap. One per sector, written in Luenio's voice, aimed at
 * the query a business owner actually types ("página web para gimnasios"), with
 * the simulation linked as the proof rather than standing in for the pitch.
 *
 * `dir` names the page directory (`apps/web/pages/servicios/<dir>/`) and the
 * Vite entry. `slug` is the whole public path (`/<slug>`): flat and
 * keyword-exact on purpose, because a shorter URL that reads as the query beats
 * a tidy `/servicios/<slug>` hierarchy nobody searches for.
 *
 * `sectorId` points at `config/sectors.js` so the demo link, the preview image
 * and the sector's Spanish slug are all derived, never retyped. `guideSlug`
 * points at `config/guides.js` for the same reason.
 */

export const SERVICES = Object.freeze([
  Object.freeze({
    dir: "gimnasios",
    slug: "paginas-web-para-gimnasios",
    sectorId: "gym",
    guideSlug: "chatbot-whatsapp",
    title: "Páginas web para gimnasios en Colombia",
    summary:
      "Web para gimnasios con horarios de clases, captación de prospectos y seguimiento automático por WhatsApp. Mira un ejemplo real y pide tu cotización gratuita.",
  }),
  Object.freeze({
    dir: "restaurantes",
    slug: "paginas-web-para-restaurantes",
    sectorId: "restaurants",
    guideSlug: "conectar-web-con-whatsapp",
    title: "Páginas web para restaurantes en Colombia",
    summary:
      "Carta digital, reservas y pedidos por WhatsApp para restaurantes. Mira un ejemplo navegable y pide una cotización gratuita, sin compromiso.",
  }),
  Object.freeze({
    dir: "inmobiliarias",
    slug: "paginas-web-para-inmobiliarias",
    sectorId: "real-estate",
    guideSlug: "conectar-web-con-whatsapp",
    title: "Páginas web para inmobiliarias en Colombia",
    summary:
      "Web inmobiliaria con fichas de propiedades, captación de interesados y seguimiento por WhatsApp. Mira un ejemplo real y pide tu cotización gratuita.",
  }),
  Object.freeze({
    dir: "tiendas-online",
    slug: "paginas-web-para-tiendas-online",
    sectorId: "ecommerce",
    guideSlug: "conectar-web-con-whatsapp",
    title: "Páginas web para tiendas online en Colombia",
    summary:
      "Tienda online que conecta catálogo, conversación por WhatsApp y seguimiento de pedidos. Mira un ejemplo navegable y pide tu cotización gratuita.",
  }),
  Object.freeze({
    dir: "veterinarias",
    slug: "paginas-web-para-veterinarias",
    sectorId: "veterinary",
    guideSlug: "chatbot-whatsapp",
    title: "Páginas web para veterinarias en Colombia",
    summary:
      "Web para clínicas veterinarias con agenda de citas, orientación al dueño y recordatorios por WhatsApp. Mira un ejemplo real y pide tu cotización.",
  }),
  Object.freeze({
    dir: "centros-de-estetica",
    slug: "paginas-web-para-centros-de-estetica",
    sectorId: "aesthetics",
    guideSlug: "chatbot-whatsapp",
    title: "Páginas web para centros de estética",
    summary:
      "Web para centros de estética con diagnóstico, agenda de tratamientos y seguimiento por WhatsApp. Mira un ejemplo navegable y pide tu cotización.",
  }),
  Object.freeze({
    dir: "agencias",
    slug: "paginas-web-para-agencias",
    sectorId: "agencies",
    guideSlug: "whatsapp-business-api",
    title: "Páginas web y automatización para agencias",
    summary:
      "Captación, seguimiento y automatización para agencias de marketing en Colombia. Mira un ejemplo navegable y pide tu cotización gratuita.",
  }),
]);

/** Canonical public path of a service page, e.g. `/paginas-web-para-gimnasios`. */
export function servicePath(service) {
  return `/${service.slug}`;
}

export function getService(dir) {
  const service = SERVICES.find((entry) => entry.dir === dir);
  if (!service) throw new Error(`Unknown service "${dir}". Declare it in config/services.js.`);
  return service;
}
