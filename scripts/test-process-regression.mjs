import { spawn } from "node:child_process";
import net from "node:net";
import { stopTestProcess, testProcessOptions } from "./test-process.mjs";

function reservePort() {
  return new Promise((resolve, reject) => {
    const reservation = net.createServer();
    reservation.once("error", reject);
    reservation.listen(0, "127.0.0.1", () => resolve(reservation));
  });
}

function canConnect(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });
}

const reservation = await reservePort();
const port = reservation.address().port;
await new Promise((resolve, reject) =>
  reservation.close((error) => (error ? reject(error) : resolve())),
);

const fixture = spawn(
  process.execPath,
  ["scripts/test-process-fixture.mjs", String(port)],
  testProcessOptions({ stdio: ["ignore", "pipe", "inherit"], windowsHide: true }),
);

try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Fixture did not become ready.")), 15_000);
    fixture.once("error", reject);
    fixture.stdout.on("data", (chunk) => {
      if (!chunk.toString().includes("READY")) return;
      clearTimeout(timer);
      resolve();
    });
  });
  if (!(await canConnect(port))) throw new Error("Grandchild listener was not reachable.");
  await stopTestProcess(fixture, { label: "process-tree regression fixture", timeoutMs: 250 });
  if (await canConnect(port)) throw new Error("Grandchild listener survived process-tree cleanup.");
  console.info("Process-tree timeout/cleanup regression passed");
} finally {
  if (fixture.exitCode === null && fixture.signalCode === null) {
    await stopTestProcess(fixture, { label: "process-tree regression finalizer", timeoutMs: 250 });
  }
}
