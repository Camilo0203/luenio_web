import { fetchPublicConfig } from "./api-client.js";

let configPromise;

export function getPublicConfig() {
  if (!configPromise) {
    configPromise = fetchPublicConfig().catch(() => ({
      gaMeasurementId: null,
      analyticsEnabled: false,
      turnstileSiteKey: null,
      turnstileRequired: false,
    }));
  }
  return configPromise;
}
