import { execFile } from "node:child_process";
import fs from "node:fs";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const delay = (timeoutMs) => new Promise((resolve) => setTimeout(resolve, timeoutMs));

export function testProcessOptions(options = {}) {
  return { ...options, detached: process.platform !== "win32" };
}

export class CleanupVerificationError extends Error {
  constructor(message) {
    super(message);
    this.name = "CleanupVerificationError";
  }
}

function isAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

async function waitUntilStopped(pids, timeoutMs, isTrackedAlive = isAlive) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (pids.every((pid) => !isTrackedAlive(pid))) return true;
    await delay(50);
  }
  return pids.every((pid) => !isTrackedAlive(pid));
}

async function unixDescendants(rootPid) {
  const { stdout } = await execFileAsync("ps", ["-eo", "pid=,ppid="]);
  const children = new Map();
  for (const line of stdout.split(/\r?\n/)) {
    const [pid, parentPid] = line.trim().split(/\s+/).map(Number);
    if (!Number.isInteger(pid) || !Number.isInteger(parentPid)) continue;
    const siblings = children.get(parentPid) || [];
    siblings.push(pid);
    children.set(parentPid, siblings);
  }
  const descendants = [];
  const visit = (pid) => {
    for (const childPid of children.get(pid) || []) {
      visit(childPid);
      descendants.push(childPid);
    }
  };
  visit(rootPid);
  return descendants;
}

async function signalTree(child, signal, descendants) {
  if (process.platform === "win32") {
    try {
      child.kill(signal === "SIGKILL" ? "SIGKILL" : "SIGTERM");
    } catch {
      // taskkill below remains the process-tree fallback on Windows.
    }
    const args = ["/PID", String(child.pid), "/T"];
    if (signal === "SIGKILL") args.push("/F");
    try {
      await execFileAsync("taskkill", args, { windowsHide: true });
    } catch {
      // Verification below decides whether cleanup succeeded.
    }
    return;
  }
  try {
    process.kill(-child.pid, signal);
  } catch {
    for (const pid of descendants) {
      try {
        process.kill(pid, signal);
      } catch {
        /* already exited */
      }
    }
    try {
      process.kill(child.pid, signal);
    } catch {
      /* already exited */
    }
  }
}

/** Stops and verifies the complete process tree created by a test command. */
export async function stopTestProcess(child, { label = "test server", timeoutMs = 5_000 } = {}) {
  if (!child?.pid) return;
  let descendants = [];
  if (process.platform !== "win32") {
    try {
      descendants = await unixDescendants(child.pid);
    } catch {
      /* use process group */
    }
  }
  const trackedPids = [child.pid, ...descendants];
  const isChildExited = () => child.exitCode !== null || child.signalCode !== null;
  const isTrackedAlive = (pid) => (pid === child.pid && isChildExited() ? false : isAlive(pid));
  if (trackedPids.every((pid) => !isTrackedAlive(pid))) return;

  await signalTree(child, "SIGTERM", descendants);
  if (await waitUntilStopped(trackedPids, timeoutMs, isTrackedAlive)) return;
  await signalTree(child, "SIGKILL", descendants);
  if (await waitUntilStopped(trackedPids, 2_000, isTrackedAlive)) return;

  child.stdout?.destroy();
  child.stderr?.destroy();
  child.stdin?.destroy();
  child.unref();
  const survivors = trackedPids.filter(isTrackedAlive);
  const message = `${label} cleanup could not be verified; surviving PID(s): ${survivors.join(", ")}.`;
  if (process.env.LUENIO_CLEANUP_FAILURE_FILE) {
    fs.writeFileSync(process.env.LUENIO_CLEANUP_FAILURE_FILE, message, "utf8");
  }
  throw new CleanupVerificationError(message);
}
