import { spawn } from "node:child_process";
import net from "node:net";

const npmCliPath = process.env.npm_execpath || null;

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: { ...process.env, ...(options.env || {}) },
      stdio: options.stdio || "inherit",
      windowsHide: true,
    });

    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} exited with code ${code}.`));
    });
  });
}

function runNpmScript(scriptName, options = {}) {
  if (npmCliPath) {
    return run(process.execPath, [npmCliPath, "run", scriptName], options);
  }

  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  return run(npmCommand, ["run", scriptName], options);
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

async function waitForServer(baseUrl, timeoutMs = 10_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {
      // Keep polling until the server is ready.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Server did not become ready within ${timeoutMs}ms.`);
}

async function runE2EWithServer() {
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, ["server.js"], {
    cwd: process.cwd(),
    env: { ...process.env, HOST: "127.0.0.1", PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  let output = "";
  server.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  server.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });
  const closePromise = new Promise((resolve) => {
    server.once("close", resolve);
  });

  try {
    await waitForServer(baseUrl);
    await runNpmScript("test:e2e", {
      env: {
        E2E_BASE_URL: baseUrl,
      },
    });
  } catch (error) {
    error.message = `${error.message}\n\nServer output:\n${output || "(no output)"}`;
    throw error;
  } finally {
    if (server.exitCode === null && !server.killed) {
      server.kill();
      await closePromise;
    }
  }
}

const steps = [
  ["Build", () => runNpmScript("build")],
  ["Architecture boundaries", () => runNpmScript("test:architecture")],
  ["API error boundary", () => runNpmScript("test:api-errors")],
  ["Automation privacy", () => runNpmScript("test:automation")],
  ["Auth security", () => runNpmScript("test:auth")],
  ["Billing checkout guard", () => runNpmScript("test:billing")],
  ["Contact public response privacy", () => runNpmScript("test:contact")],
  ["Core trust boundary", () => runNpmScript("test:core")],
  ["Data hygiene", () => runNpmScript("test:data")],
  ["Production readiness", () => runNpmScript("test:readiness")],
  ["Development port fallback", () => runNpmScript("test:dev-port")],
  ["Industry demo system", () => runNpmScript("test:demo-system")],
  ["Niche landing conversion pages", () => runNpmScript("test:niche-landings")],
  ["Endpoint rate limits", () => runNpmScript("test:rate-limit")],
  ["Sellable SaaS product experience", () => runNpmScript("test:sellable")],
  ["Supabase schema", () => runNpmScript("test:schema")],
  ["Strict storage guard", () => runNpmScript("test:strict-storage")],
  ["Stripe webhook guard", () => runNpmScript("test:stripe-webhook")],
  ["Server smoke", () => runNpmScript("test:smoke")],
  ["Storage boundary", () => runNpmScript("test:storage")],
  ["Production server smoke", () => runNpmScript("test:smoke:prod")],
  ["Full SaaS E2E", runE2EWithServer],
];

for (const [label, step] of steps) {
  console.info(`\n[production-gate] ${label}`);
  await step();
}

console.info("\nProduction gate passed");
