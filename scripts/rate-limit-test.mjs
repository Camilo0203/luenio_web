import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";

function assert(condition, message) {
  if (!condition) throw new Error(message);
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
      // Keep polling until the temporary server is ready.
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Server did not become ready within ${timeoutMs}ms.`);
}

async function postContact(baseUrl, index) {
  const response = await fetch(`${baseUrl}/api/contact`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      name: `Rate Limit Lead ${index}`,
      business: "Rate Limit Business",
      phone: `+57300123${String(index).padStart(4, "0")}`,
      service: "Automatización de WhatsApp",
      message: "Valid request used to verify endpoint-specific rate limiting.",
      source: "rate_limit_test",
    }),
  });
  const body = await response.json();
  return { response, body };
}

const port = await getFreePort();
const baseUrl = `http://127.0.0.1:${port}`;
const localDbPath = path.join(process.cwd(), "db", "leads-db.json");
const localDbSnapshot = fs.existsSync(localDbPath) ? fs.readFileSync(localDbPath, "utf8") : null;
const server = spawn(process.execPath, ["server.js"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    HOST: "127.0.0.1",
    PORT: String(port),
    SENSITIVE_RATE_LIMIT_MAX: "2",
    RATE_LIMIT_MAX: "100",
  },
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

  const first = await postContact(baseUrl, 1);
  const second = await postContact(baseUrl, 2);
  const third = await postContact(baseUrl, 3);

  assert(first.response.ok, `First sensitive request should pass: ${JSON.stringify(first.body)}`);
  assert(second.response.ok, `Second sensitive request should pass: ${JSON.stringify(second.body)}`);
  assert(third.response.status === 429, "Third sensitive request must be rate limited.");
  assert(third.body.error === "Too many requests", "Rate limit response must be explicit.");

  const health = await fetch(`${baseUrl}/api/health`);
  assert(health.ok, "Health endpoint must remain available after sensitive endpoint throttling.");

  console.info("Endpoint rate limit guard passed");
} catch (error) {
  error.message = `${error.message}\n\nServer output:\n${output || "(no output)"}`;
  throw error;
} finally {
  if (server.exitCode === null && !server.killed) {
    server.kill();
    await closePromise;
  }
  if (localDbSnapshot !== null) {
    fs.writeFileSync(localDbPath, localDbSnapshot);
  } else if (fs.existsSync(localDbPath)) {
    fs.unlinkSync(localDbPath);
  }
}
