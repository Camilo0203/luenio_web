import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const envPath = process.argv[2] || process.env.EDGE_ENV_FILE;
let failed = false;

function fail(message) {
  failed = true;
  console.error(`[edge-preflight] ${message}`);
}

if (!envPath || !path.isAbsolute(envPath) || !fs.existsSync(envPath)) {
  fail("Provide an existing absolute edge env path as the first argument or EDGE_ENV_FILE.");
} else {
  const fileStat = fs.statSync(envPath);
  if (!fileStat.isFile()) fail("The edge env path must reference a regular file.");
  if (process.platform !== "win32" && (fileStat.mode & 0o077) !== 0) {
    fail("The edge env file must not be accessible by group or others (expected mode 600).");
  }
  const seenKeys = new Set();
  const values = Object.fromEntries(
    fs
      .readFileSync(envPath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separator = line.indexOf("=");
        const key = line.slice(0, separator).trim();
        if (!/^[A-Z][A-Z0-9_]*$/.test(key)) fail("The edge env file contains an invalid key.");
        if (seenKeys.has(key)) fail(`The edge env file contains duplicate key ${key}.`);
        seenKeys.add(key);
        return [
          key,
          line
            .slice(separator + 1)
            .trim()
            .replace(/^["']|["']$/g, ""),
        ];
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
else
  console.info(
    "[edge-preflight] Shared VPS edge configuration is ready; no secret values were printed.",
  );
