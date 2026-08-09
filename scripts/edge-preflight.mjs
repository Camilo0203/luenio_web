import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const envPath = process.argv[2] || process.env.EDGE_ENV_FILE;
let failed = false;

function fail(message) {
  failed = true;
  console.error(`[edge-preflight] ${message}`);
}

if (!envPath || !fs.existsSync(envPath)) {
  fail("Provide an existing edge env path as the first argument or EDGE_ENV_FILE.");
} else {
  const values = Object.fromEntries(
    fs
      .readFileSync(envPath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
  const required = [
    "TRUSTED_PROXY_SECRET_PRODUCTION",
    "TRUSTED_PROXY_SECRET_STAGING",
    "N8N_BASIC_AUTH_USER_PRODUCTION",
    "N8N_BASIC_AUTH_HASH_PRODUCTION",
    "N8N_BASIC_AUTH_USER_STAGING",
    "N8N_BASIC_AUTH_HASH_STAGING",
  ];
  required.forEach((key) => {
    if (!values[key]) fail(`${key} is required.`);
    if (/CHANGE_ME|placeholder|example/i.test(values[key] || "")) {
      fail(`${key} still contains a placeholder.`);
    }
  });
  for (const key of ["TRUSTED_PROXY_SECRET_PRODUCTION", "TRUSTED_PROXY_SECRET_STAGING"]) {
    if ((values[key] || "").length < 32) fail(`${key} must contain at least 32 characters.`);
  }
  if (
    values.TRUSTED_PROXY_SECRET_PRODUCTION &&
    values.TRUSTED_PROXY_SECRET_PRODUCTION === values.TRUSTED_PROXY_SECRET_STAGING
  ) {
    fail("Production and staging proxy secrets must be different.");
  }
}

for (const relativePath of ["Caddyfile", "ops/edge-compose.yml", "docker-compose.yml"]) {
  if (!fs.existsSync(path.join(root, relativePath))) fail(`${relativePath} is missing.`);
}

if (failed) process.exitCode = 1;
else console.info("[edge-preflight] Shared VPS edge configuration is ready.");
