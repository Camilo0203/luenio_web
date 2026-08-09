import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const envPath = path.join(process.cwd(), ".env");
for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i <= 0) continue;
  const k = t.slice(0, i).trim();
  let v = t.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  if (!process.env[k]) process.env[k] = v;
}

const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function probe(label, pathname, options = {}) {
  const res = await fetch(`${url}/rest/v1/${pathname}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  console.log(label, res.status, text.slice(0, 400));
  return { res, text };
}

const sid = `session_debug_${Date.now()}`;
const tokenHash = crypto.createHash("sha256").update("debug").digest("hex");

await probe("session insert", "sessions", {
  method: "POST",
  body: JSON.stringify({
    id: sid,
    user_id: "usr_luenio_admin",
    token_hash: tokenHash,
    ip_hash: "a".repeat(64),
    user_agent_hash: "b".repeat(64),
    expires_at: new Date(Date.now() + 3600_000).toISOString(),
    created_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
  }),
});

// cleanup
await probe("session delete", `sessions?id=eq.${encodeURIComponent(sid)}`, {
  method: "DELETE",
  headers: { Prefer: "return=minimal" },
});

const login = await fetch("http://127.0.0.1:4180/api/auth", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    action: "login",
    email: "meltrinox@gmail.com",
    password: "definitely-wrong-password-12345",
  }),
});
console.log("login wrong", login.status, await login.text());
