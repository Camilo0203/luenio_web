/**
 * The seven sectors, declared once.
 *
 * Adding an eighth used to mean editing fourteen files: the route maps in
 * server.js, the Vite input list, the sitemap, and ten test scripts that each
 * kept their own copy of the list. Everything that is merely *derived* from a
 * sector — its routes, its build entry, its canonical URL — now comes from here.
 *
 * `id` is the canonical English slug. It names the page directory
 * (`apps/web/pages/<id>/`), the simulation directory
 * (`apps/web/pages/demo/<id>/`) and the English alias route (`/<id>`).
 *
 * `esSlug` is the canonical public path (`/<esSlug>`): the one in the sitemap
 * and the one the site links to. The English alias resolves to the same page so
 * old links keep working.
 *
 * `brand` is the fictional business the landing and its simulation portray.
 * `previewSlug` names the files under `public/assets/previews/`; it defaults to
 * `id` and only exists because the agency previews were cut as "agency".
 */

export const SECTORS = Object.freeze(
  [
    { id: "agencies", esSlug: "agencias", brand: "Impulso Digital", previewSlug: "agency" },
    { id: "ecommerce", esSlug: "tiendas-online", brand: "NovaStore" },
    { id: "real-estate", esSlug: "inmobiliarias", brand: "Hogar Prime" },
    { id: "gym", esSlug: "gimnasios", brand: "Titan Fitness Club" },
    { id: "restaurants", esSlug: "restaurantes", brand: "Sabor & Fuego" },
    { id: "veterinary", esSlug: "veterinarias", brand: "Huella Veterinaria" },
    { id: "aesthetics", esSlug: "esteticas", brand: "Aura Estética" },
  ].map((sector) => Object.freeze({ previewSlug: sector.id, ...sector })),
);

export function getSector(id) {
  const sector = SECTORS.find((entry) => entry.id === id);
  if (!sector) throw new Error(`Unknown sector "${id}". Declare it in config/sectors.js.`);
  return sector;
}

/** Canonical public path of the sector landing, e.g. `/inmobiliarias`. */
export function nichePath(sector) {
  return `/${sector.esSlug}`;
}

/** Canonical public path of the sector simulation, e.g. `/demo/real-estate`. */
export function demoPath(sector) {
  return `/demo/${sector.id}`;
}
