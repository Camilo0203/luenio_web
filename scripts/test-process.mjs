const delay = (timeoutMs) => new Promise((resolve) => setTimeout(resolve, timeoutMs));

async function waitForClose(child, timeoutMs) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return true;

  return Promise.race([
    new Promise((resolve) => child.once("close", () => resolve(true))),
    delay(timeoutMs).then(() => false),
  ]);
}

/**
 * Stops a child process without allowing a test runner to hang forever.
 * Windows can acknowledge ChildProcess.kill() before the close event arrives,
 * so every graceful stop has a bounded forced-stop fallback.
 */
export async function stopTestProcess(child, { label = "test server", timeoutMs = 5_000 } = {}) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;

  child.kill();
  if (await waitForClose(child, timeoutMs)) return;

  child.kill("SIGKILL");
  if (await waitForClose(child, 2_000)) return;

  child.stdout?.destroy();
  child.stderr?.destroy();
  child.stdin?.destroy();
  child.unref();
  throw new Error(`${label} did not exit after a forced stop.`);
}
