import fs from "node:fs";
import path from "node:path";
import {
  storeCrmRecord,
  storePublicInquiry,
  updateLeadPipeline,
  updateUserSubscription,
} from "../db/storage.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const localDbPath = path.join(process.cwd(), "db", "leads-db.json");
const localDbSnapshot = fs.existsSync(localDbPath) ? fs.readFileSync(localDbPath, "utf8") : null;

try {
  let failedClosed = false;
  try {
    await storePublicInquiry({
      name: "Missing ID",
      business: "Storage Boundary",
      phone: "+573001110000",
      service: "Automatizacion de WhatsApp",
      message: "Storage should not create domain ids.",
      source: "storage_boundary",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    failedClosed = error.message === "inquiry id is required to store public inquiry.";
  }

  assert(failedClosed, "Storage must reject public inquiries without a server-owned id.");

  let incompleteCrmRecordRejected = false;
  try {
    await storeCrmRecord({
      lead: {
        id: "lead_storage_boundary",
        userId: "user_storage_boundary",
        phone: "+573001110001",
      },
      action: { id: "action_storage_boundary", userId: "user_storage_boundary" },
      events: [],
    });
  } catch (error) {
    incompleteCrmRecordRejected =
      error.message === "notification id is required to store CRM data.";
  }

  assert(
    incompleteCrmRecordRejected,
    "Storage must reject CRM bundles without prebuilt notification ids.",
  );

  let missingPipelineEventRejected = false;
  try {
    await updateLeadPipeline(
      "lead_storage_boundary",
      { status: "converted", pipelineStage: "converted" },
      "user_storage_boundary",
    );
  } catch (error) {
    missingPipelineEventRejected =
      error.message === "pipeline event id is required to update CRM data.";
  }

  assert(
    missingPipelineEventRejected,
    "Storage must reject pipeline updates without prebuilt domain events.",
  );

  let missingSubscriptionEventRejected = false;
  try {
    await updateUserSubscription({
      id: "subscription_storage_boundary",
      userId: "user_storage_boundary",
      plan: "starter",
      status: "active",
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    missingSubscriptionEventRejected =
      error.message === "subscription event id is required to update subscription.";
  }

  assert(
    missingSubscriptionEventRejected,
    "Storage must reject subscription updates without prebuilt domain events.",
  );
  console.info("Storage boundary guard passed");
} finally {
  if (localDbSnapshot !== null) {
    fs.writeFileSync(localDbPath, localDbSnapshot);
  } else if (fs.existsSync(localDbPath)) {
    fs.unlinkSync(localDbPath);
  }
}
