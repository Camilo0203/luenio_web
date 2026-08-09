/**
 * Parse a simple CRM CSV (header row required).
 * Expected columns (case-insensitive): name, business, phone, service, source, message, tags
 */

const HEADER_ALIASES = {
  name: ["name", "nombre"],
  business: ["business", "negocio", "empresa", "company"],
  phone: ["phone", "telefono", "teléfono", "whatsapp", "celular"],
  service: ["service", "servicio", "interes", "interés"],
  source: ["source", "fuente", "origen"],
  message: ["message", "mensaje", "notas", "notes"],
  tags: ["tags", "etiquetas"],
};

function splitCsvLine(line) {
  const cells = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function mapHeader(headerCell) {
  const normalized = String(headerCell || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    if (
      aliases.some((alias) => alias.normalize("NFD").replace(/[\u0300-\u036f]/g, "") === normalized)
    ) {
      return field;
    }
  }
  return null;
}

/**
 * @param {string} text
 * @param {{ maxRows?: number }} options
 * @returns {{ rows: object[], errors: string[], headers: string[] }}
 */
export function parseCrmCsv(text, { maxRows = 100 } = {}) {
  const lines = String(text || "")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return { rows: [], errors: ["El CSV necesita encabezado y al menos una fila."], headers: [] };
  }

  const headerCells = splitCsvLine(lines[0]);
  const fieldIndex = {};
  headerCells.forEach((cell, index) => {
    const field = mapHeader(cell);
    if (field) fieldIndex[field] = index;
  });

  const required = ["name", "business", "phone", "service"];
  const missing = required.filter((field) => fieldIndex[field] === undefined);
  if (missing.length) {
    return {
      rows: [],
      errors: [`Faltan columnas obligatorias: ${missing.join(", ")}`],
      headers: headerCells,
    };
  }

  const rows = [];
  const errors = [];
  for (let i = 1; i < lines.length; i += 1) {
    if (rows.length >= maxRows) {
      errors.push(`Se truncó el import a ${maxRows} filas.`);
      break;
    }
    const cells = splitCsvLine(lines[i]);
    const row = {
      name: cells[fieldIndex.name] || "",
      business: cells[fieldIndex.business] || "",
      phone: cells[fieldIndex.phone] || "",
      service: cells[fieldIndex.service] || "",
      source:
        fieldIndex.source !== undefined ? cells[fieldIndex.source] || "import_csv" : "import_csv",
      message: fieldIndex.message !== undefined ? cells[fieldIndex.message] || "" : "",
      tags: fieldIndex.tags !== undefined ? cells[fieldIndex.tags] || "" : "",
    };
    if (!row.name || !row.business || !row.phone || !row.service) {
      errors.push(`Fila ${i + 1}: faltan campos obligatorios.`);
      continue;
    }
    rows.push(row);
  }

  return { rows, errors, headers: headerCells };
}
