/**
 * Smoke test for Agency CRM API (/api/crm/*).
 * Requires a running server + Neon DATABASE_URL.
 *
 *   CRM_SMOKE_BASE=http://127.0.0.1:4180 npm run test:crm-api
 */
const base = (process.env.CRM_SMOKE_BASE || "http://127.0.0.1:4180").replace(/\/$/, "");

let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    console.error(`  ✗ ${msg}`);
    failed += 1;
  } else {
    console.info(`  ✓ ${msg}`);
  }
}

async function req(path, { method = "GET", body } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { res, json, status: res.status };
}

async function main() {
  console.info(`CRM API smoke → ${base}`);

  // 1 health
  {
    const { status, json } = await req("/api/crm/health");
    assert(status === 200, `health status 200 (got ${status})`);
    assert(json?.ok === true, "health ok === true");
  }

  // 2 me (dev public → 200; prod locked without cookie → 401)
  {
    const { status, json } = await req("/api/crm/me");
    assert(status === 200 || status === 401, `me status 200|401 (got ${status})`);
    if (status === 200) {
      assert(json?.data && typeof json.data === "object", "me has data object");
    }
  }

  // 3 dashboard
  {
    const { status, json } = await req("/api/crm/dashboard");
    assert(status === 200, `dashboard status 200 (got ${status})`);
    assert(json?.data && typeof json.data === "object", "dashboard has data");
    const d = json?.data || {};
    const hasMetric = "mrr" in d || "openPipeline" in d || "activeClients" in d || "pipeline" in d;
    assert(hasMetric, "dashboard has known metric keys");
  }

  // 4 pipeline
  {
    const { status, json } = await req("/api/crm/pipeline");
    assert(status === 200, `pipeline status 200 (got ${status})`);
    assert(json?.data && typeof json.data === "object", "pipeline has board data");
  }

  // 5 create lead
  let leadId = null;
  {
    const name = `Smoke ${Date.now()}`;
    const { status, json } = await req("/api/crm/leads", {
      method: "POST",
      body: { name, value: 1, probability: 10, stage: "nuevo" },
    });
    assert(status === 201, `POST leads 201 (got ${status})`);
    leadId = json?.data?.id || null;
    assert(Boolean(leadId), "POST leads returns data.id");
    assert(json?.data?.name === name, "POST leads name matches");
  }

  // 6 patch stage
  if (leadId) {
    const { status, json } = await req(`/api/crm/leads/${leadId}/stage`, {
      method: "PATCH",
      body: { stage: "contactado", position: 0 },
    });
    assert(status === 200, `PATCH stage 200 (got ${status})`);
    assert(json?.data?.stage === "contactado", "stage is contactado");
  } else {
    assert(false, "PATCH stage skipped — no leadId");
  }

  // 7 clients
  {
    const { status, json } = await req("/api/crm/clients?limit=5");
    assert(status === 200, `clients status 200 (got ${status})`);
    assert(Array.isArray(json?.data), "clients data is array");
  }

  // 8 debug/error — 500 in dev, 404 when locked
  {
    const { status } = await req("/api/crm/debug/error");
    assert(status === 500 || status === 404, `debug/error status 500|404 (got ${status})`);
  }

  if (failed > 0) {
    console.error(`\nCRM API smoke FAILED (${failed} assertion(s))`);
    process.exit(1);
  }
  console.info("\nCRM API smoke passed");
}

main().catch((err) => {
  console.error("CRM API smoke crashed:", err?.message || err);
  process.exit(1);
});
