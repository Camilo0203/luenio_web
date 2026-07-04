process.env.REQUIRE_SUPABASE = "true";
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const { getStorageHealth, listCrmData, testStorageConnection } = await import("../db/storage.js");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const health = getStorageHealth();
assert(health.mode === "supabase_required_missing", `Expected strict missing mode, got ${health.mode}.`);
assert(health.supabaseRequired === true, "Supabase should be marked as required.");
assert(health.supabaseConfigured === false, "Supabase should not be configured in this test.");

for (const operation of [testStorageConnection, listCrmData]) {
  let failed = false;
  try {
    await operation();
  } catch (error) {
    failed = error.message.includes("Supabase is required");
  }
  assert(failed, "Strict storage operation must fail without Supabase credentials.");
}

console.info("Strict Supabase storage guard passed");
