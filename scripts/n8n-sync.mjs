/**
 * Respalda la instancia de n8n y regenera su documentación.
 *
 * Los 41 workflows del chatbot vivían solo dentro del VPS. Este script los trae
 * al repositorio sin credenciales y escribe `n8n/ARCHITECTURE.md` a partir de lo
 * que hay de verdad en la instancia, no de lo que alguien recuerde: el mapa no
 * puede quedarse obsoleto porque se vuelve a derivar en cada ejecución.
 *
 *   N8N_URL=https://n8n.ejemplo.com N8N_API_KEY=... node scripts/n8n-sync.mjs
 *   node scripts/n8n-sync.mjs --check    # falla si el respaldo está desfasado
 */

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const instanceDir = path.join(root, "n8n", "instance");
const docPath = path.join(root, "n8n", "ARCHITECTURE.md");
const checkOnly = process.argv.includes("--check");

const baseUrl = (process.env.N8N_URL || "").replace(/\/+$/, "");
const apiKey = process.env.N8N_API_KEY || "";
if (!baseUrl || !apiKey) {
  console.error("ERROR: define N8N_URL y N8N_API_KEY.");
  console.error("La API key se genera en n8n: Settings -> n8n API -> Create an API key.");
  process.exit(1);
}

function slug(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** El respaldo describe la lógica, nunca los secretos. */
function sanitize(workflow) {
  return {
    name: workflow.name,
    active: workflow.active,
    nodes: (workflow.nodes || []).map((node) => {
      const copy = { ...node };
      delete copy.credentials;
      return copy;
    }),
    connections: workflow.connections,
    settings: workflow.settings,
    staticData: workflow.staticData ?? null,
  };
}

async function fetchWorkflows() {
  const response = await fetch(`${baseUrl}/api/v1/workflows?limit=250`, {
    headers: { "X-N8N-API-KEY": apiKey },
  });
  if (!response.ok) {
    throw new Error(`La API de n8n respondió ${response.status} ${response.statusText}.`);
  }
  const body = await response.json();
  return (body.data || []).sort((a, b) => a.name.localeCompare(b.name, "es"));
}

function triggerOf(workflow) {
  const trigger = (workflow.nodes || []).find((node) => /trigger|webhook/i.test(node.type));
  return trigger ? trigger.type.split(".").pop() : "—";
}

/** prod / staging / lab, deducido del nombre y del propósito. */
function categoryOf(workflow) {
  if (/probe|self-test|cleanup|inspect|limpiar|inicializar|test$/i.test(workflow.name))
    return "lab";
  if (/\[STAGING/i.test(workflow.name)) return "staging";
  return "prod";
}

function buildCallGraph(workflows) {
  const calledBy = new Map();
  for (const workflow of workflows) {
    for (const node of workflow.nodes || []) {
      if (!/executeWorkflow$/i.test(node.type)) continue;
      const id = node.parameters?.workflowId?.value ?? node.parameters?.workflowId;
      if (!id) continue;
      if (!calledBy.has(id)) calledBy.set(id, new Set());
      calledBy.get(id).add(workflow.name);
    }
  }
  return calledBy;
}

function collectSheetSchema(workflows) {
  const tabs = new Map();
  for (const workflow of workflows) {
    for (const node of workflow.nodes || []) {
      if (!/googleSheets/i.test(node.type)) continue;
      const tab =
        node.parameters?.sheetName?.cachedResultName || node.parameters?.sheetName?.value || "?";
      const schema = node.parameters?.columns?.schema || [];
      const names = schema.length
        ? schema.map((column) => column.id)
        : Object.keys(node.parameters?.columns?.value || {});
      if (!names.length) continue;
      if (!tabs.has(tab)) tabs.set(tab, new Set());
      names.forEach((name) => tabs.get(tab).add(name));
    }
  }
  return tabs;
}

/** Lo que está construido y no se ejecuta: lo que hay que decidir, no adivinar. */
function findGaps(workflows, calledBy) {
  const gaps = [];
  for (const workflow of workflows) {
    const category = categoryOf(workflow);
    const trigger = triggerOf(workflow);
    const callers = calledBy.get(workflow.id);

    if (category === "staging" && workflow.active) {
      gaps.push([workflow.name, "workflow de staging **activo en producción**"]);
    }
    if (category === "prod" && /scheduleTrigger/i.test(trigger) && !workflow.active) {
      gaps.push([workflow.name, "programado pero **apagado**: nunca se ejecuta"]);
    }
    if (category === "prod" && /executeWorkflowTrigger/i.test(trigger) && !callers) {
      gaps.push([workflow.name, "sub-workflow que **nadie invoca**"]);
    }
  }
  return gaps;
}

function renderDoc(workflows, calledBy) {
  const byCategory = { prod: [], staging: [], lab: [] };
  for (const workflow of workflows) byCategory[categoryOf(workflow)].push(workflow);

  const lines = [];
  lines.push("# Arquitectura de la instancia de n8n");
  lines.push("");
  lines.push(
    "Generado por `scripts/n8n-sync.mjs` desde la instancia real. No editar a mano:",
    "se sobrescribe en cada sincronización.",
  );
  lines.push("");
  lines.push(
    `Workflows: **${workflows.length}** — ${byCategory.prod.length} de producción, ` +
      `${byCategory.staging.length} de staging, ${byCategory.lab.length} de laboratorio.`,
  );
  lines.push("");

  lines.push("## Camino de un mensaje");
  lines.push("");
  lines.push("```text");
  lines.push("WhatsApp (Meta)");
  lines.push("      |");
  lines.push("  Chatwoot            chat.ton618bot.xyz");
  lines.push("      |  POST webhook");
  lines.push("  Luenio Chatbot      90 nodos: seguridad, deduplicación, estado");
  lines.push("      |");
  lines.push("  LUNA | Orquestar turno v3");
  lines.push("      |-- Interpretar mensaje      JavaScript determinista, sin LLM");
  lines.push("      |-- Consultar KB y objeciones");
  lines.push("      +-- Decidir turno            JavaScript determinista, sin LLM");
  lines.push("      |");
  lines.push("  Google Sheets       documento «Luenio Chatbot»");
  lines.push("```");
  lines.push("");
  lines.push(
    "El cerebro **no usa un modelo de lenguaje**: `Interpretar mensaje` y `Decidir turno`",
    "son código determinista sin llamadas externas. OpenRouter solo aparece en",
    "`Luenio Chatbot [STAGING AUTO]`, la arquitectura anterior.",
  );
  lines.push("");

  lines.push("## CRM en Google Sheets");
  lines.push("");
  for (const [tab, columns] of collectSheetSchema(workflows)) {
    lines.push(`### Pestaña \`${tab}\` — ${columns.size} columnas`);
    lines.push("");
    lines.push([...columns].map((column) => `\`${column}\``).join(", "));
    lines.push("");
  }
  const porNombre = [];
  for (const workflow of workflows) {
    for (const node of workflow.nodes || []) {
      if (!/googleSheets/i.test(node.type)) continue;
      const ref = node.parameters?.sheetName;
      const mode = typeof ref === "object" ? ref.mode : "cadena";
      if (mode === "name" || mode === "cadena") {
        porNombre.push(`${workflow.name} / ${node.name} -> \`${ref?.value ?? ref}\``);
      }
    }
  }
  if (porNombre.length) {
    lines.push(
      `> ${porNombre.length} nodo(s) referencian su pestaña **por nombre**; el resto usa el`,
      "> identificador, que sobrevive a un renombrado. Estos no:",
    );
    porNombre.forEach((entry) => lines.push(`> - ${entry}`));
  } else {
    lines.push("> Todos los nodos referencian su pestaña por identificador.");
  }
  lines.push(
    "",
    "> El nombre en caché que guarda n8n puede estar desfasado respecto al nombre real",
    "> de la pestaña; no es un fallo mientras la referencia sea por identificador.",
  );
  lines.push("");

  const gaps = findGaps(workflows, calledBy);
  lines.push("## Huecos detectados");
  lines.push("");
  if (!gaps.length) {
    lines.push("Ninguno.");
  } else {
    for (const [name, issue] of gaps) lines.push(`- **${name}** — ${issue}`);
  }
  lines.push("");

  for (const [category, title] of [
    ["prod", "Producción"],
    ["staging", "Staging"],
    ["lab", "Laboratorio y pruebas"],
  ]) {
    lines.push(`## ${title}`);
    lines.push("");
    lines.push("| Workflow | Estado | Disparador | Invocado por |");
    lines.push("| --- | --- | --- | --- |");
    for (const workflow of byCategory[category]) {
      const callers = calledBy.get(workflow.id);
      lines.push(
        `| ${workflow.name} | ${workflow.active ? "activo" : "inactivo"} | ${triggerOf(workflow)} | ${
          callers ? [...callers].join(", ") : "—"
        } |`,
      );
    }
    lines.push("");
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n") + "\n";
}

const workflows = await fetchWorkflows();
const calledBy = buildCallGraph(workflows);

const files = new Map();
for (const workflow of workflows) {
  files.set(
    path.join(instanceDir, `${slug(workflow.name)}.json`),
    JSON.stringify(sanitize(workflow), null, 2) + "\n",
  );
}
files.set(docPath, renderDoc(workflows, calledBy));

if (checkOnly) {
  const stale = [...files].filter(([file, content]) => {
    if (!fs.existsSync(file)) return true;
    return fs.readFileSync(file, "utf8") !== content;
  });
  if (stale.length) {
    console.error(`El respaldo de n8n está desfasado en ${stale.length} archivo(s):`);
    stale.slice(0, 10).forEach(([file]) => console.error(`  ${path.relative(root, file)}`));
    console.error("Ejecuta: node scripts/n8n-sync.mjs");
    process.exit(1);
  }
  console.info(`El respaldo de n8n está al día (${workflows.length} workflows).`);
} else {
  fs.mkdirSync(instanceDir, { recursive: true });
  for (const [file, content] of files) fs.writeFileSync(file, content);
  console.info(`${workflows.length} workflows respaldados en n8n/instance/`);
  console.info(`Mapa regenerado en n8n/ARCHITECTURE.md`);
  const gaps = findGaps(workflows, calledBy);
  if (gaps.length) {
    console.info(`\n${gaps.length} hueco(s) detectado(s):`);
    gaps.forEach(([name, issue]) => console.info(`  ${name}: ${issue.replace(/\*\*/g, "")}`));
  }
}
