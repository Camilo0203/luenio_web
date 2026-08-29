/**
 * Reads a public page the way it ships.
 *
 * Pages declare their shared header, footer and legal bar with an
 * `<!-- include: … -->` directive, so reading the raw file no longer shows the
 * chrome. Source assertions go through here and see the same markup Vite writes
 * into `dist/` and the dev server returns.
 */

import fs from "node:fs";
import path from "node:path";
import { expandIncludes } from "../lib/html-includes.js";

const root = process.cwd();
const partialsDir = path.join(root, "apps", "web", "partials");

export function readPageHtml(relativePath) {
  const raw = fs.readFileSync(path.join(root, relativePath), "utf8").replaceAll("\r\n", "\n");
  return expandIncludes(raw, { partialsDir, sourceLabel: relativePath });
}
