/**
 * Build-time HTML includes for the shared public chrome.
 *
 * The header, footer and legal bar used to be copied into every page, so the
 * three of them drifted apart silently: different menu-toggle markup, a nav that
 * rendered 10px narrower, a CTA at a different weight. A page now declares the
 * shared block instead of restating it:
 *
 *   <!-- include: site-header nav="site" ctaLocation="legal_header" -->
 *
 * The same expansion runs in two places so source and build never disagree:
 * `htmlIncludePlugin()` inside Vite (build and `vite dev`), and `server.js` when
 * it serves the source tree (`SERVE_DIST=false`). Production serves `dist/`,
 * which Vite already expanded.
 *
 * Partials live in `apps/web/partials/` and support two constructs:
 *
 *   {{name}}                          substitute a parameter, HTML-escaped
 *   {{#if name}}A{{else}}B{{/if}}     branch on parameter presence
 *   {{#if name=value}}A{{/if}}        branch on an exact parameter value
 *   {{!-- note --}}                   authoring note, never rendered
 *
 * Anything unexpected throws: an unknown partial, a `{{name}}` with no matching
 * parameter, a `{{#if name=value}}` the page never supplied a `name` for, or a
 * parameter the partial never reads. A silent empty header is exactly the
 * failure this module exists to prevent.
 */

import fs from "node:fs";
import path from "node:path";

const DIRECTIVE_PATTERN =
  /([ \t]*)<!--\s*include:\s*([a-z][a-z0-9-]*)((?:\s+[a-zA-Z][\w-]*="[^"]*")*)\s*-->/g;
const PARAM_PATTERN = /\s+([a-zA-Z][\w-]*)="([^"]*)"/g;
const CONTROL_PATTERN = /(\{\{#if\s+[\w-]+(?:=[\w-]+)?\}\}|\{\{else\}\}|\{\{\/if\}\})/;
const IF_OPEN_PATTERN = /^\{\{#if\s+([\w-]+)(?:=([\w-]+))?\}\}$/;
const SUBSTITUTION_PATTERN = /\{\{\s*([\w-]+)\s*\}\}/g;
const TEMPLATE_COMMENT_PATTERN = /\{\{!--[\s\S]*?--\}\}\n?/g;
const MAX_INCLUDE_DEPTH = 8;

const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (character) => HTML_ESCAPES[character]);
}

export function hasIncludeDirectives(html) {
  return /<!--\s*include:/.test(html);
}

function parseParams(rawParams) {
  const params = {};
  for (const match of rawParams.matchAll(PARAM_PATTERN)) {
    params[match[1]] = match[2];
  }
  return params;
}

/** A parameter counts as present unless it is empty or the literal "false". */
function isTruthy(value) {
  return value !== undefined && value !== "" && value !== "false";
}

/**
 * `{{#if key}}` tests presence; `{{#if key=value}}` tests an exact value and
 * insists the page supplied the key at all, so a forgotten parameter fails loudly
 * instead of quietly rendering none of the branches.
 */
function evaluateCondition(key, expected, params, label) {
  if (expected === undefined) return isTruthy(params[key]);
  if (!(key in params)) {
    throw new Error(`${label}: {{#if ${key}=${expected}}} needs a "${key}" parameter.`);
  }
  return params[key] === expected;
}

/**
 * Resolves {{#if}}/{{else}}/{{/if}} with a token scanner rather than line by
 * line, so reformatting a partial cannot change which branch it renders.
 */
function resolveConditionals(template, params, label) {
  const tokens = template.split(CONTROL_PATTERN);
  const stack = [];
  let output = "";

  for (const token of tokens) {
    const openMatch = token.match(IF_OPEN_PATTERN);
    if (openMatch) {
      const [, key, expected] = openMatch;
      const taken = evaluateCondition(key, expected, params, label);
      const parentEmits = stack.every((frame) => frame.emitting);
      stack.push({ emitting: parentEmits && taken, taken });
      continue;
    }
    if (token === "{{else}}") {
      const frame = stack[stack.length - 1];
      if (!frame) throw new Error(`${label}: {{else}} outside of an {{#if}} block.`);
      const parentEmits = stack.slice(0, -1).every((entry) => entry.emitting);
      frame.emitting = parentEmits && !frame.taken;
      continue;
    }
    if (token === "{{/if}}") {
      if (!stack.pop()) throw new Error(`${label}: {{/if}} without a matching {{#if}}.`);
      continue;
    }
    if (stack.every((frame) => frame.emitting)) output += token;
  }

  if (stack.length) throw new Error(`${label}: ${stack.length} unclosed {{#if}} block(s).`);
  return output;
}

function substitute(template, params, label) {
  return template.replace(SUBSTITUTION_PATTERN, (_match, key) => {
    if (!(key in params)) {
      throw new Error(`${label}: no value supplied for {{${key}}}.`);
    }
    return escapeHtml(params[key]);
  });
}

/**
 * Every parameter name the partial mentions anywhere, branches it does not take
 * included. A page passing a name that appears nowhere has made a typo.
 */
function declaredParams(template) {
  const names = new Set();
  for (const match of template.matchAll(/\{\{#if\s+([\w-]+)/g)) names.add(match[1]);
  for (const match of template.matchAll(SUBSTITUTION_PATTERN)) names.add(match[1]);
  return names;
}

/** Drops whitespace-only lines left behind by a discarded branch. */
function tidy(html) {
  return html
    .replace(/[ \t]+$/gm, "")
    .replace(/^\n+|\n+$/g, "")
    .replace(/\n[ \t]*(?=\n)/g, "");
}

function indentBlock(html, indent) {
  if (!indent) return html;
  return html
    .split("\n")
    .map((line) => (line ? `${indent}${line}` : line))
    .join("\n");
}

function readPartial(name, partialsDir) {
  const file = path.join(partialsDir, `${name}.html`);
  if (!fs.existsSync(file)) {
    throw new Error(`Unknown HTML partial "${name}" (expected ${file}).`);
  }
  return fs.readFileSync(file, "utf8").replace(TEMPLATE_COMMENT_PATTERN, "");
}

/**
 * Expands every `<!-- include: … -->` directive in `html`.
 *
 * @param {string} html
 * @param {{ partialsDir: string, sourceLabel?: string, depth?: number }} options
 * @returns {string}
 */
export function expandIncludes(html, { partialsDir, sourceLabel = "html", depth = 0 }) {
  if (depth > MAX_INCLUDE_DEPTH) {
    throw new Error(`${sourceLabel}: include nesting exceeded ${MAX_INCLUDE_DEPTH} levels.`);
  }
  if (!hasIncludeDirectives(html)) return html;

  const expanded = html.replace(DIRECTIVE_PATTERN, (_directive, indent, name, rawParams) => {
    const params = parseParams(rawParams);
    const label = `${sourceLabel} -> partial "${name}"`;

    const template = readPartial(name, partialsDir);
    const declared = declaredParams(template);
    const unknown = Object.keys(params).filter((key) => !declared.has(key));
    if (unknown.length) {
      throw new Error(`${label}: parameter(s) the partial never mentions: ${unknown.join(", ")}.`);
    }

    let rendered = resolveConditionals(template, params, label);
    rendered = substitute(rendered, params, label);
    rendered = expandIncludes(rendered, { partialsDir, sourceLabel: label, depth: depth + 1 });

    return indentBlock(tidy(rendered), indent);
  });

  if (hasIncludeDirectives(expanded)) {
    throw new Error(
      `${sourceLabel}: an include directive survived expansion. Check its syntax: ` +
        `<!-- include: name key="value" -->`,
    );
  }

  return expanded;
}

/**
 * Vite plugin. Runs before Vite rewrites asset URLs so partial markup is treated
 * exactly like markup authored in the page.
 */
export function htmlIncludePlugin({ partialsDir }) {
  return {
    name: "luenio-html-includes",
    transformIndexHtml: {
      order: "pre",
      handler(html, context) {
        return expandIncludes(html, {
          partialsDir,
          sourceLabel: context?.path || context?.filename || "index.html",
        });
      },
    },
  };
}
