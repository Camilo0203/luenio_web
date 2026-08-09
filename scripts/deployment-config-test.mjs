import fs from "node:fs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const compose = fs.readFileSync("docker-compose.yml", "utf8");
const edgeCompose = fs.readFileSync("ops/edge-compose.yml", "utf8");
const caddy = fs.readFileSync("Caddyfile", "utf8");
const productionEnv = fs.readFileSync(".env.production.example", "utf8");
const edgeEnv = fs.readFileSync(".env.edge.example", "utf8");
const backupEnv = fs.readFileSync(".env.backup.example", "utf8");
const deployEnvironment = fs.readFileSync("ops/deploy-environment.sh", "utf8");
const healthService = fs.readFileSync("ops/systemd/luenio-health@.service", "utf8");
const maintenanceService = fs.readFileSync(
  "ops/systemd/luenio-security-maintenance.service",
  "utf8",
);

assert(!compose.includes("container_name:"), "Environment stacks must not fix container names.");
for (const contract of [
  "LUENIO_ENV_FILE",
  "APP_EDGE_ALIAS",
  "N8N_EDGE_ALIAS",
  "EDGE_NETWORK",
  "app_internal:",
  "automation_internal:",
]) {
  assert(compose.includes(contract), `Environment Compose must include ${contract}.`);
}
for (const network of ["luenio-production-edge", "luenio-staging-edge"]) {
  assert(edgeCompose.includes(network), `Edge Compose must attach ${network}.`);
}
for (const target of [
  "app-production:4180",
  "app-staging:4180",
  "n8n-production:5678",
  "n8n-staging:5678",
]) {
  assert(caddy.includes(target), `Caddy must route to ${target}.`);
}
assert(
  caddy.includes('X-Robots-Tag "noindex, nofollow"'),
  "Staging and automation surfaces must be noindex.",
);
for (const variable of [
  "SENTRY_DSN_SERVER",
  "SENTRY_DSN_PUBLIC",
  "GA_MEASUREMENT_ID",
  "LUENIO_IMAGE",
]) {
  assert(productionEnv.includes(`${variable}=`), `Production env must declare ${variable}.`);
}
assert(
  edgeEnv.includes("TRUSTED_PROXY_SECRET_PRODUCTION") &&
    edgeEnv.includes("TRUSTED_PROXY_SECRET_STAGING"),
  "Edge env must keep independent proxy secrets.",
);
assert(
  healthService.includes("/etc/luenio/%i.env"),
  "Health checks must load the selected environment explicitly.",
);
assert(
  maintenanceService.includes("/etc/luenio/production.env"),
  "Security maintenance must use the production environment explicitly.",
);
for (const variable of ["PRODUCTION_ENV_FILE", "STAGING_ENV_FILE", "RCLONE_REMOTE"]) {
  assert(backupEnv.includes(`${variable}=`), `Backup env must declare ${variable}.`);
}
for (const deploymentGuard of [
  "node scripts/production-preflight.mjs",
  'EDGE_NETWORK" == "luenio-$ENVIRONMENT-edge',
  'APP_EDGE_ALIAS" == "app-$ENVIRONMENT',
  'N8N_EDGE_ALIAS" == "n8n-$ENVIRONMENT',
]) {
  assert(
    deployEnvironment.includes(deploymentGuard),
    `Environment deploy must enforce ${deploymentGuard}.`,
  );
}

console.info("Shared VPS deployment configuration guard passed");
