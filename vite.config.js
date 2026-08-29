import { defineConfig } from "vite";
import { resolve } from "node:path";
import { htmlIncludePlugin } from "./lib/html-includes.js";
import { publicPageEntries } from "./lib/public-routes.js";

const includeAgencyCrm = process.env.ENABLE_AGENCY_CRM === "true";

const input = Object.fromEntries(
  Object.entries(publicPageEntries({ includeAgencyCrm })).map(([name, page]) => [
    name,
    resolve(__dirname, page),
  ]),
);

export default defineConfig({
  plugins: [htmlIncludePlugin({ partialsDir: resolve(__dirname, "apps/web/partials") })],
  build: {
    rollupOptions: { input },
  },
});
