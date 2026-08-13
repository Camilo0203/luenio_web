async function requestJson(pathname, options = {}) {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), 15_000);
  const abortFromCaller = () => controller.abort(options.signal?.reason);
  if (options.signal?.aborted) abortFromCaller();
  else options.signal?.addEventListener("abort", abortFromCaller, { once: true });

  try {
    const response = await fetch(pathname, {
      ...options,
      signal: controller.signal,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {}),
      },
    });
    const data = await response.json().catch(() => ({}));
    return { response, data };
  } finally {
    globalThis.clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abortFromCaller);
  }
}

export async function getSession() {
  return requestJson("/api/auth");
}

export async function getPublicConfig() {
  return requestJson("/api/public-config", { credentials: "same-origin" });
}

export async function getAuthGuard() {
  return requestJson("/api/auth?guard=1", { credentials: "same-origin" });
}

export async function authenticate(payload) {
  return requestJson("/api/auth", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function acceptInvitation(payload) {
  return requestJson("/api/invitations/accept", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getInvitations() {
  return requestJson("/api/invitations");
}

export async function createInvitation(payload) {
  return requestJson("/api/invitations", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function revokeInvitation(invitationId) {
  return requestJson("/api/invitations/revoke", {
    method: "POST",
    body: JSON.stringify({ invitationId }),
  });
}

export async function requestPasswordReset(email) {
  return requestJson("/api/password-reset/request", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function confirmPasswordReset(payload) {
  return requestJson("/api/password-reset/confirm", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function logout() {
  return requestJson("/api/auth", {
    method: "POST",
    body: JSON.stringify({ action: "logout" }),
  });
}

export async function listSessions() {
  return requestJson("/api/auth?sessions=1");
}

export async function revokeSession(sessionId) {
  return requestJson("/api/auth", {
    method: "POST",
    body: JSON.stringify({ action: "revoke_session", sessionId }),
  });
}

export async function revokeOtherSessions() {
  return requestJson("/api/auth", {
    method: "POST",
    body: JSON.stringify({ action: "revoke_other_sessions" }),
  });
}

export async function getLeads({ q = "", limit, cursor } = {}) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (limit) params.set("limit", String(limit));
  if (cursor) params.set("cursor", cursor);
  const query = params.toString();
  return requestJson(query ? `/api/leads?${query}` : "/api/leads");
}

export async function bulkUpdateLeads({ leadIds, status, pipelineStage, addTags, assigneeUserId }) {
  return requestJson("/api/process", {
    method: "POST",
    body: JSON.stringify({
      mode: "bulk",
      leadIds,
      status,
      pipelineStage,
      addTags,
      assigneeUserId,
    }),
  });
}

export async function importLeads(rows) {
  return requestJson("/api/leads", {
    method: "POST",
    body: JSON.stringify({ mode: "import", rows }),
  });
}

export async function getHealth() {
  return requestJson("/api/health");
}

export async function getBilling() {
  return requestJson("/api/billing");
}

export async function createCheckout(plan) {
  return requestJson("/api/billing", {
    method: "POST",
    body: JSON.stringify({ plan }),
  });
}

export async function getSettings() {
  return requestJson("/api/settings");
}

export async function updatePipeline({
  leadId,
  status,
  pipelineStage,
  notes,
  tags,
  nextAction,
  nextActionAt,
  logContact,
  assigneeUserId,
}) {
  const payload = { leadId };
  if (status !== undefined) payload.status = status;
  if (pipelineStage !== undefined) payload.pipelineStage = pipelineStage;
  if (notes !== undefined) payload.notes = notes;
  if (tags !== undefined) payload.tags = tags;
  if (nextAction !== undefined) payload.nextAction = nextAction;
  if (nextActionAt !== undefined) payload.nextActionAt = nextActionAt;
  if (logContact !== undefined) payload.logContact = logContact;
  if (assigneeUserId !== undefined) payload.assigneeUserId = assigneeUserId;
  return requestJson("/api/process", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function previewDigest() {
  return requestJson("/api/process", {
    method: "POST",
    body: JSON.stringify({ mode: "digest" }),
  });
}
