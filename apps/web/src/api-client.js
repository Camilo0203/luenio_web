async function readJson(response) {
  return response.json().catch(() => ({}));
}

export async function submitPublicInquiry(lead) {
  const response = await fetch("/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(lead),
  });
  const result = await readJson(response);

  if (!response.ok) {
    throw new Error(result.error || `Contact endpoint responded ${response.status}`);
  }

  return Object.keys(result).length ? result : { ok: true };
}

export async function submitCrmLead(lead) {
  const response = await fetch("/api/leads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(lead),
  });
  const result = await readJson(response);

  if (response.status === 401) {
    const error = new Error("AUTH_REQUIRED");
    error.statusCode = 401;
    throw error;
  }

  if (!response.ok) {
    const error = new Error(result.error || `Lead endpoint responded ${response.status}`);
    error.statusCode = response.status;
    throw error;
  }

  return Object.keys(result).length ? result : { ok: true };
}
