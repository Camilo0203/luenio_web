/**
 * The city pages, declared once.
 *
 * Local queries ("diseño web Bogotá") carry the highest commercial intent on the
 * whole site and the least competition, so they get their own pages. What they
 * do not get is a fake address.
 *
 * `presence` decides how each page is allowed to describe itself, and it is the
 * only field here that matters ethically:
 *
 * - `"office"` — Luenio actually works from this city. It is the city in the
 *   `PostalAddress` of the `#organization` node on the home page, the page may
 *   say "estamos en", and its JSON-LD may carry that same address.
 * - `"remote"` — Luenio serves this city but has no premises in it. The page
 *   says so in plain words, the JSON-LD gets `areaServed` and nothing else, and
 *   under no circumstance does it invent a street, a local phone number or a
 *   `PostalAddress`. Inventing one is the exact pattern Google's spam policy on
 *   misrepresented locations is written against, and it is also just a lie to a
 *   prospect who might drive there.
 *
 * `dir` names the page directory (`apps/web/pages/ciudades/<dir>/`) and the Vite
 * entry; `slug` is the whole public path (`/<slug>`).
 */

export const LOCATIONS = Object.freeze([
  Object.freeze({
    dir: "bogota",
    slug: "diseno-web-bogota",
    presence: "office",
    city: "Bogotá",
    cityFull: "Bogotá D.C.",
    region: "Bogotá D.C.",
    title: "Diseño web en Bogotá para negocios | Luenio",
    summary:
      "Diseño de páginas web y automatización con WhatsApp para negocios de Bogotá. Trabajamos desde Bogotá. Diagnóstico y cotización gratuitos.",
  }),
  Object.freeze({
    dir: "medellin",
    slug: "diseno-web-medellin",
    presence: "remote",
    city: "Medellín",
    cityFull: "Medellín, Antioquia",
    region: "Antioquia",
    title: "Diseño web en Medellín para negocios | Luenio",
    summary:
      "Diseño de páginas web y automatización con WhatsApp para negocios de Medellín. Trabajamos en remoto desde Bogotá. Cotización gratuita.",
  }),
]);

/** Canonical public path of a city page, e.g. `/diseno-web-bogota`. */
export function locationPath(location) {
  return `/${location.slug}`;
}

/** True when Luenio actually works from the city and may claim a street address. */
export function hasOffice(location) {
  return location.presence === "office";
}
