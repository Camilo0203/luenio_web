/**
 * Luenio Guard — interactive human verification when Cloudflare Turnstile
 * is not configured. Complements honeypot + form timing on login.
 */
import crypto from "node:crypto";
import { getSecurityConfig, getTurnstileEnv, isProduction } from "../../config/env.js";

const CHALLENGE_TTL_MS = 5 * 60 * 1_000;
const MIN_FORM_MS = 1_200;
const MAX_FORM_MS = 2 * 60 * 60 * 1_000;
/** @type {Map<string, { answer: string, exp: number, ipHash: string }>} */
const challenges = new Map();

const TILES = [
  { id: "shield", label: "Escudo", emoji: "🛡️" },
  { id: "key", label: "Llave", emoji: "🔑" },
  { id: "lock", label: "Candado", emoji: "🔒" },
  { id: "radar", label: "Radar", emoji: "📡" },
  { id: "bolt", label: "Rayo", emoji: "⚡" },
  { id: "globe", label: "Globo", emoji: "🌐" },
];

function pruneChallenges() {
  const now = Date.now();
  for (const [id, row] of challenges) {
    if (row.exp <= now) challenges.delete(id);
  }
  // hard cap
  if (challenges.size > 5_000) {
    const entries = [...challenges.entries()].sort((a, b) => a[1].exp - b[1].exp);
    for (const [id] of entries.slice(0, challenges.size - 4_000)) challenges.delete(id);
  }
}

function hashIp(ip) {
  const secret = getSecurityConfig().authSecret || "luenio-local-development-secret-change-me";
  return crypto
    .createHmac("sha256", secret)
    .update(String(ip || "unknown"))
    .digest("hex")
    .slice(0, 32);
}

function guardError(message, statusCode = 400, code = "GUARD_FAILED") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  error.publicMessage = message;
  return error;
}

/**
 * Public challenge payload for the login UI.
 */
export function createLoginGuardChallenge(request = {}) {
  pruneChallenges();
  const turnstile = getTurnstileEnv();
  if (turnstile.required && turnstile.siteKey && turnstile.secretKey) {
    return {
      mode: "turnstile",
      turnstileSiteKey: turnstile.siteKey,
      turnstileRequired: true,
    };
  }
  // Prefer Turnstile when site key exists even if not required
  if (turnstile.siteKey && turnstile.secretKey) {
    return {
      mode: "turnstile",
      turnstileSiteKey: turnstile.siteKey,
      turnstileRequired: false,
      optional: true,
    };
  }

  const pool = [...TILES].sort(() => Math.random() - 0.5).slice(0, 4);
  const correct = pool[Math.floor(Math.random() * pool.length)];
  const challengeId = crypto.randomBytes(16).toString("base64url");
  challenges.set(challengeId, {
    answer: correct.id,
    exp: Date.now() + CHALLENGE_TTL_MS,
    ipHash: hashIp(request.clientIp),
  });

  return {
    mode: "luenio-guard",
    challengeId,
    prompt: `Haz clic en: ${correct.label}`,
    promptTarget: correct.label,
    options: pool.map((t) => ({ id: t.id, label: t.label, emoji: t.emoji })),
    expiresInSeconds: Math.floor(CHALLENGE_TTL_MS / 1000),
    honeypot: true,
    minFormMs: MIN_FORM_MS,
  };
}

export function assertLoginBotProtection(body = {}, request = {}) {
  // Honeypot
  if (String(body.website || body.company_url || "").trim()) {
    throw guardError("Solicitud bloqueada.", 400, "HONEYPOT");
  }

  // Timing
  const started = new Date(body.formStartedAt || body.form_started_at || 0).getTime();
  if (!Number.isFinite(started) || started <= 0) {
    throw guardError("Sesión del formulario inválida. Recarga la página.", 400, "FORM_TIMING");
  }
  const elapsed = Date.now() - started;
  if (elapsed < MIN_FORM_MS) {
    throw guardError(
      "Envío demasiado rápido. Espera un segundo e inténtalo.",
      400,
      "FORM_TOO_FAST",
    );
  }
  if (elapsed > MAX_FORM_MS) {
    throw guardError("El formulario expiró. Recarga la página.", 400, "FORM_EXPIRED");
  }

  const turnstile = getTurnstileEnv();
  const hasTurnstileKeys = Boolean(turnstile.siteKey && turnstile.secretKey);
  const token = String(body.turnstileToken || "").trim();

  // If Turnstile required, caller should validate token separately — still allow path
  if (turnstile.required && hasTurnstileKeys) {
    if (!token) throw guardError("Completa la verificación anti-bot.", 400, "TURNSTILE_REQUIRED");
    return { mode: "turnstile" };
  }

  // Optional turnstile token present → trust path (validated by validateTurnstileToken)
  if (token && hasTurnstileKeys) {
    return { mode: "turnstile", hasToken: true };
  }

  // Luenio Guard interactive challenge
  const challengeId = String(body.guardChallengeId || "").trim();
  const answer = String(body.guardAnswer || "").trim();
  if (!challengeId || !answer) {
    throw guardError("Completa la verificación humana (Luenio Guard).", 400, "GUARD_REQUIRED");
  }

  pruneChallenges();
  const row = challenges.get(challengeId);
  challenges.delete(challengeId); // one-time use
  if (!row || row.exp <= Date.now()) {
    throw guardError(
      "La verificación expiró. Vuelve a seleccionar el icono.",
      400,
      "GUARD_EXPIRED",
    );
  }
  // Soft bind to IP (warn only in production if mismatch — still require correct answer)
  if (isProduction() && row.ipHash && row.ipHash !== hashIp(request.clientIp)) {
    throw guardError("Verificación inválida para esta red. Recarga e inténtalo.", 400, "GUARD_IP");
  }
  if (row.answer !== answer) {
    throw guardError("Verificación incorrecta. Elige el icono indicado.", 400, "GUARD_WRONG");
  }
  return { mode: "luenio-guard", ok: true };
}
