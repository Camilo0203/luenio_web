import { spawn } from "node:child_process";
import http from "node:http";
import assert from "node:assert/strict";

function reservePort() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((request, response) => {
      response.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("reserved");
    });

    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({ server, port: address.port });
    });
  });
}

function closeServer(server) {
  return new Promise((resolve) => server.close(resolve));
}

function waitForServer(child, { expectExit = false } = {}) {
  return new Promise((resolve, reject) => {
    let output = "";
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for server output. Output:\n${output}`));
    }, 8000);

    function cleanup() {
      clearTimeout(timeout);
      child.stdout.off("data", onData);
      child.stderr.off("data", onData);
      child.off("exit", onExit);
      child.off("error", onError);
    }

    function onData(chunk) {
      output += chunk.toString();
      const match = output.match(/Full SaaS server running at http:\/\/127\.0\.0\.1:(\d+)/);
      if (match && !expectExit) {
        cleanup();
        resolve({ output, port: Number(match[1]) });
      }
    }

    function onExit(code) {
      if (expectExit) {
        cleanup();
        resolve({ output, code });
        return;
      }
      cleanup();
      reject(new Error(`Server exited early with code ${code}. Output:\n${output}`));
    }

    function onError(error) {
      cleanup();
      reject(error);
    }

    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.once("exit", onExit);
    child.once("error", onError);
  });
}

function spawnServer(env) {
  return spawn(process.execPath, ["server.js"], {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
}

async function fetchHealth(port) {
  const response = await fetch(`http://127.0.0.1:${port}/api/health`);
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.ok, true);
}

async function testDevelopmentFallback() {
  const reserved = await reservePort();
  const child = spawnServer({
    HOST: "127.0.0.1",
    PORT: String(reserved.port),
    NODE_ENV: "development",
  });

  try {
    const result = await waitForServer(child);
    assert.notEqual(result.port, reserved.port, "development server should use a fallback port");
    assert.match(result.output, /Falling back to an available development port/);
    await fetchHealth(result.port);
  } finally {
    child.kill("SIGTERM");
    await closeServer(reserved.server);
  }
}

async function testProductionFailsOnOccupiedPort() {
  const reserved = await reservePort();
  const child = spawnServer({
    HOST: "127.0.0.1",
    PORT: String(reserved.port),
    NODE_ENV: "production",
  });

  try {
    const result = await waitForServer(child, { expectExit: true });
    assert.notEqual(result.code, 0, "production server must fail when configured port is occupied");
    assert.match(result.output, /Server failed to start|EADDRINUSE/);
  } finally {
    child.kill("SIGTERM");
    await closeServer(reserved.server);
  }
}

await testDevelopmentFallback();
await testProductionFailsOnOccupiedPort();

console.info("Development port fallback test passed.");
