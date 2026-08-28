import net from "node:net";

/**
 * Shared bootstrap helpers for the scripts that spawn an isolated server.
 *
 * Each of them used to carry its own copy of these two functions, which drifted
 * into six different readiness timeouts (10s to 60s) and left the shortest ones
 * expiring on a cold, contended machine before a healthy server had finished
 * booting. The env each script needs still differs too much to share a whole
 * startServer, so only the parts that are genuinely identical live here.
 */

export function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

/**
 * Poll until the server answers its health check.
 *
 * Pass `child` so a server that dies during boot fails immediately with its exit
 * code instead of burning the whole timeout on a process that will never answer.
 */
export async function waitForServer(baseUrl, options = {}) {
  const {
    timeoutMs = 45_000,
    child = null,
    healthPath = "/api/health",
    intervalMs = 200,
    label = "Test server",
  } = typeof options === "number" ? { timeoutMs: options } : options;

  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (child && child.exitCode !== null && child.exitCode !== undefined) {
      throw new Error(`${label} exited early with code ${child.exitCode}.`);
    }
    try {
      const response = await fetch(`${baseUrl}${healthPath}`);
      if (response.ok) return;
    } catch {
      // Keep polling until the isolated server is ready.
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`${label} did not become ready at ${baseUrl}.`);
}

/**
 * Collect a spawned server's stdout and stderr, keeping only the tail.
 *
 * Both pipes must be drained: a script that declares `stdio: ["ignore","pipe",
 * "pipe"]` and never reads them gets no diagnostics when readiness fails, and a
 * chatty server can fill the 64 KB pipe buffer and block on write.
 */
export function captureOutput(child, maxChunks = 200) {
  const chunks = [];
  const collect = (chunk) => {
    chunks.push(String(chunk));
    if (chunks.length > maxChunks) chunks.splice(0, chunks.length - maxChunks);
  };
  child.stdout?.on("data", collect);
  child.stderr?.on("data", collect);
  return () => chunks.join("");
}
