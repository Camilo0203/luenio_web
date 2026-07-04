async function requestJson(pathname, options = {}) {
  const response = await fetch(pathname, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

export async function getSession() {
  return requestJson("/api/auth");
}

export async function authenticate(payload) {
  return requestJson("/api/auth", {
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

export async function getLeads() {
  return requestJson("/api/leads");
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

export async function updatePipeline({ leadId, status, pipelineStage }) {
  return requestJson("/api/process", {
    method: "POST",
    body: JSON.stringify({ leadId, status, pipelineStage }),
  });
}
