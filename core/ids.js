function normalizePrefix(prefix) {
  return (
    String(prefix || "record")
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "") || "record"
  );
}

function randomHex(bytes = 16) {
  const cryptoApi = globalThis.crypto;

  if (cryptoApi?.randomUUID) {
    return cryptoApi.randomUUID().replace(/-/g, "");
  }

  if (cryptoApi?.getRandomValues) {
    const values = cryptoApi.getRandomValues(new Uint8Array(bytes));
    return Array.from(values, (value) => value.toString(16).padStart(2, "0")).join("");
  }

  throw new Error("Secure random generator unavailable.");
}

export function generateRecordId(prefix) {
  return `${normalizePrefix(prefix)}_${Date.now()}_${randomHex()}`;
}
