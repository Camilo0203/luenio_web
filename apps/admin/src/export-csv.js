function escapeCsv(value) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

/** Build UTF-8 BOM CSV and trigger browser download. */
export function downloadLeadsCsv(leads, { onExported } = {}) {
  const headers = [
    "id",
    "name",
    "business",
    "phone",
    "service",
    "classification",
    "score",
    "stage",
    "source",
    "tags",
    "notes",
    "created_at",
  ];
  const rows = leads.map((lead) =>
    [
      lead.id,
      lead.name,
      lead.business,
      lead.phone,
      lead.service,
      lead.classification,
      lead.score,
      lead.status,
      lead.source,
      (lead.tags || []).join("|"),
      lead.notes || "",
      lead.timestamp || "",
    ]
      .map(escapeCsv)
      .join(","),
  );
  const csv = [`\uFEFF${headers.join(",")}`, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  anchor.href = url;
  anchor.download = `luenio-leads-${stamp}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  onExported?.(leads.length);
}
