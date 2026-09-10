/**
 * Every public route, build entry and sitemap URL, derived from config/sectors.js.
 *
 * server.js used to carry 70 hand-written route entries — each sector spelled
 * out four times for the landing (English slug, Spanish slug, each with and
 * without a trailing slash) and four more for the simulation. They are generated
 * here instead, so a new sector is one row in the table and nothing else.
 *
 * The resolvers return OS-native path fragments relative to
 * `apps/web/pages/`, which is what server.js joins onto the app root.
 */

import path from "node:path";
import { GUIDES, guidePath } from "../config/guides.js";
import { LOCATIONS, locationPath } from "../config/locations.js";
import { SECTORS, nichePath } from "../config/sectors.js";
import { SERVICES, servicePath } from "../config/services.js";

/** Both spellings of a route: with and without the trailing slash. */
function withTrailingSlash(route) {
  return [route, `${route}/`];
}

function assign(routes, aliases, target) {
  for (const alias of aliases) routes[alias] = target;
}

function buildDemoRoutes() {
  const routes = {};
  const catalog = "index.html";
  assign(routes, [...withTrailingSlash("/demo"), ...withTrailingSlash("/demos")], catalog);

  for (const sector of SECTORS) {
    assign(
      routes,
      [...withTrailingSlash(`/demo/${sector.id}`), ...withTrailingSlash(`/demos/${sector.id}`)],
      path.join(sector.id, "index.html"),
    );
  }
  return routes;
}

function buildNicheRoutes() {
  const routes = {};
  for (const sector of SECTORS) {
    assign(
      routes,
      [...withTrailingSlash(`/${sector.id}`), ...withTrailingSlash(`/${sector.esSlug}`)],
      path.join(sector.id, "index.html"),
    );
  }
  return routes;
}

/**
 * Legal, pricing, guide, service and city pages: not sector-derived, but kept
 * beside the rest. The service and city slugs are flat on purpose — the public
 * path is the query, not a folder — so only the directory carries the grouping.
 */
function buildInfoRoutes() {
  const routes = {};
  const pages = [
    ["/terminos", path.join("legal", "terminos", "index.html")],
    ["/privacidad", path.join("legal", "privacidad", "index.html")],
    ["/reembolsos", path.join("legal", "reembolsos", "index.html")],
    ["/cotizacion", path.join("pricing", "index.html")],
    ["/precios", path.join("pricing", "index.html")],
    ["/guias", path.join("guides", "index.html")],
    ...GUIDES.map((guide) => [guidePath(guide), path.join("guides", guide.dir, "index.html")]),
    ["/servicios", path.join("servicios", "index.html")],
    ...SERVICES.map((service) => [
      servicePath(service),
      path.join("servicios", service.dir, "index.html"),
    ]),
    ...LOCATIONS.map((location) => [
      locationPath(location),
      path.join("ciudades", location.dir, "index.html"),
    ]),
  ];
  for (const [route, target] of pages) assign(routes, withTrailingSlash(route), target);
  return routes;
}

const demoRoutes = buildDemoRoutes();
const nicheRoutes = buildNicheRoutes();
const infoRoutes = buildInfoRoutes();

export function getDemoPagePath(pathname) {
  return demoRoutes[pathname] || null;
}

export function getNichePagePath(pathname) {
  return nicheRoutes[pathname] || null;
}

export function getInfoPagePath(pathname) {
  return infoRoutes[pathname] || null;
}

function camelize(slug) {
  return slug.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Vite build entries as `{ name: posix path }`, relative to the repository root.
 * `agencyCrm` entries are gated on the frozen CRM and requested separately.
 */
export function publicPageEntries({ includeAgencyCrm = false } = {}) {
  const entries = {
    main: "apps/web/pages/home/index.html",
    notFound: "apps/web/pages/404/index.html",
    demo: "apps/web/pages/demo/index.html",
  };

  for (const sector of SECTORS) {
    const suffix = capitalize(camelize(sector.id));
    entries[`demo${suffix}`] = `apps/web/pages/demo/${sector.id}/index.html`;
    entries[`niche${suffix}`] = `apps/web/pages/${sector.id}/index.html`;
  }

  for (const guide of GUIDES) {
    entries[`guide${capitalize(camelize(guide.dir))}`] =
      `apps/web/pages/guides/${guide.dir}/index.html`;
  }

  for (const service of SERVICES) {
    entries[`service${capitalize(camelize(service.dir))}`] =
      `apps/web/pages/servicios/${service.dir}/index.html`;
  }

  for (const location of LOCATIONS) {
    entries[`city${capitalize(camelize(location.dir))}`] =
      `apps/web/pages/ciudades/${location.dir}/index.html`;
  }

  Object.assign(entries, {
    guides: "apps/web/pages/guides/index.html",
    servicios: "apps/web/pages/servicios/index.html",
    auth: "apps/admin/auth.html",
    invite: "apps/admin/invite.html",
    reset: "apps/admin/reset.html",
    admin: "apps/admin/admin.html",
    ...(includeAgencyCrm ? { app: "apps/admin/app.html", crm: "apps/admin/crm.html" } : {}),
    legalTerminos: "apps/web/pages/legal/terminos/index.html",
    legalPrivacidad: "apps/web/pages/legal/privacidad/index.html",
    legalReembolsos: "apps/web/pages/legal/reembolsos/index.html",
    pricing: "apps/web/pages/pricing/index.html",
  });

  return entries;
}

/**
 * The indexable public surface, in sitemap order. Simulations are excluded on
 * purpose: they are `noindex` and reachable from the catalog.
 */
export function canonicalPublicPaths() {
  return [
    "/",
    "/cotizacion",
    "/servicios",
    ...SERVICES.map(servicePath),
    ...LOCATIONS.map(locationPath),
    "/demos",
    ...SECTORS.map(nichePath),
    "/guias",
    ...GUIDES.map(guidePath),
    "/terminos",
    "/privacidad",
    "/reembolsos",
  ];
}
