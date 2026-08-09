/**
 * Smoke checks for secure login (Guard / Turnstile path).
 *   npm run test:auth-login
 */
const base = (process.env.AUTH_SMOKE_BASE || "http://127.0.0.1:4180").replace(/\/$/, "");
let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    console.error(`  ✗ ${msg}`);
    failed += 1;
  } else {
    console.info(`  ✓ ${msg}`);
  }
}

async function main() {
  console.info(`Auth login smoke → ${base}`);

  {
    const res = await fetch(`${base}/login`);
    const html = await res.text();
    assert(res.ok, `GET /login ${res.status}`);
    assert(html.includes("authForm") || html.includes("Entrar"), "login form markup");
    assert(html.includes("data-bot-mount") || html.includes("Luenio Guard"), "bot mount present");
    assert(html.includes("auth-live") || html.includes("Seguridad"), "security panel");
  }

  let guard;
  {
    const res = await fetch(`${base}/api/auth?guard=1`);
    guard = await res.json();
    assert(res.status === 200, `GET guard ${res.status}`);
    assert(guard.ok === true, "guard ok");
    assert(guard.mode === "luenio-guard" || guard.mode === "turnstile", `guard mode ${guard.mode}`);
    if (guard.mode === "luenio-guard") {
      assert(Boolean(guard.challengeId), "guard challengeId");
      assert(Array.isArray(guard.options) && guard.options.length >= 2, "guard options");
    }
  }

  {
    const res = await fetch(`${base}/api/auth`);
    const json = await res.json();
    assert(res.status === 200, `GET /api/auth ${res.status}`);
    assert(json.authenticated === false, "unauthenticated session");
  }

  // Login without guard → must fail
  {
    const res = await fetch(`${base}/api/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "login",
        email: "nobody-smoke@luenio.invalid",
        password: "wrong-password-12",
        formStartedAt: new Date(Date.now() - 3000).toISOString(),
      }),
    });
    const json = await res.json().catch(() => ({}));
    assert(
      res.status === 400 || res.status === 401 || res.status === 429,
      `no-guard status ${res.status}`,
    );
    assert(typeof json.error === "string", "no-guard has error");
  }

  // Login with wrong answer
  if (guard.mode === "luenio-guard") {
    const wrong = (guard.options || []).find((o) => o.id !== guard.options?.[0]?.id) || {
      id: "nope",
    };
    // re-fetch challenge for one-time id
    const g2 = await fetch(`${base}/api/auth?guard=1`).then((r) => r.json());
    const wrongId = (g2.options || []).find((o) => o.label !== g2.promptTarget)?.id || wrong.id;
    const res = await fetch(`${base}/api/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "login",
        email: "nobody-smoke@luenio.invalid",
        password: "wrong-password-12",
        formStartedAt: new Date(Date.now() - 3000).toISOString(),
        website: "",
        guardChallengeId: g2.challengeId,
        guardAnswer: wrongId,
      }),
    });
    const json = await res.json().catch(() => ({}));
    // wrong tile may 400 GUARD_WRONG, or if lucky correct tile on random — accept 400/401
    assert([400, 401, 429].includes(res.status), `guard login status ${res.status}`);
    assert(typeof json.error === "string", "guard login error string");
    assert(
      !/Storage service temporarily unavailable/i.test(json.error || ""),
      "no opaque storage error",
    );
  }

  // Correct guard + wrong password → 401
  if (guard.mode === "luenio-guard") {
    const g3 = await fetch(`${base}/api/auth?guard=1`).then((r) => r.json());
    const targetLabel = g3.promptTarget;
    const answer = (g3.options || []).find((o) => o.label === targetLabel)?.id;
    const res = await fetch(`${base}/api/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "login",
        email: "nobody-smoke@luenio.invalid",
        password: "wrong-password-12",
        formStartedAt: new Date(Date.now() - 3000).toISOString(),
        website: "",
        guardChallengeId: g3.challengeId,
        guardAnswer: answer,
      }),
    });
    const json = await res.json().catch(() => ({}));
    assert(res.status === 401 || res.status === 429, `bad creds ${res.status}`);
    assert(typeof json.error === "string", "bad creds message");
  }

  {
    const res = await fetch(`${base}/api/auth?sessions=1`);
    assert(res.status === 401, `sessions unauth ${res.status}`);
  }

  {
    const res = await fetch(`${base}/app`);
    assert(res.ok, `GET /app ${res.status}`);
  }

  if (failed) {
    console.error(`\nAuth login smoke FAILED (${failed})`);
    process.exit(1);
  }
  console.info("\nAuth login smoke passed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
