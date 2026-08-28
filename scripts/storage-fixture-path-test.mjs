import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function run(env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["-e", "import('./db/storage.js')"], {
      cwd: process.cwd(),
      env: { ...process.env, LUENIO_SKIP_ENV_FILE: "true", ...env },
      stdio: "ignore",
      windowsHide: true,
    });
    child.once("error", reject);
    child.once("close", resolve);
  });
}

const fixtureDir = path.join(process.cwd(), "test-results", `.storage-fixture-${process.pid}`);
const fixturePath = path.join(fixtureDir, "leads-db.json");
fs.mkdirSync(fixtureDir, { recursive: true });
try {
  const testCode = await run({ NODE_ENV: "test", LUENIO_LOCAL_DB_PATH: fixturePath });
  if (testCode !== 0) throw new Error("Test mode must accept an isolated local storage path.");
  const productionCode = await run({ NODE_ENV: "production", LUENIO_LOCAL_DB_PATH: fixturePath });
  if (productionCode === 0) throw new Error("Production must reject LUENIO_LOCAL_DB_PATH.");
  console.info("Storage fixture path boundary passed");
} finally {
  fs.rmSync(fixtureDir, { recursive: true, force: true });
}
