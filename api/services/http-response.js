export function getErrorStatus(error, fallbackStatus = 500) {
  const status = Number(error?.statusCode || error?.status || fallbackStatus);
  if (!Number.isInteger(status) || status < 400 || status > 599) return fallbackStatus;
  return status;
}

export function getPublicErrorMessage(error, status) {
  if (error?.publicMessage) return error.publicMessage;
  if (status >= 500) return "Internal server error.";
  return error?.message || "Request failed.";
}

export function sendApiError(response, error, options = {}) {
  const status = getErrorStatus(error, options.status || options.fallbackStatus || 500);
  const payload = {
    ok: false,
    error: getPublicErrorMessage(error, status),
  };

  if (error?.usage) payload.usage = error.usage;
  if (options.extra) Object.assign(payload, options.extra);

  return response.status(status).json(payload);
}
