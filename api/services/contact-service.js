import {
  claimContactDeliveries,
  completeContactDelivery,
  storePublicInquiry,
} from "../../db/storage.js";
import { getContactEnv, isProduction } from "../../config/env.js";
import { generateRecordId, leadFieldLimits, normalizeTextField } from "../../core/engine.js";
import { validatePublicInquirySecurity } from "./turnstile-service.js";
import { fetchWithTimeout, getSecureOutboundUrl } from "./outbound-request.js";

export class PublicInquiryValidationError extends Error {
  constructor(missingFields) {
    super("Missing required fields");
    this.name = "PublicInquiryValidationError";
    this.statusCode = 400;
    this.code = "VALIDATION_ERROR";
    this.missingFields = missingFields;
  }
}

const CONTACT_WEBHOOK_TIMEOUT_MS = 3_000;

function normalizeInquiry(body = {}) {
  return {
    id: generateRecordId("inquiry"),
    name: normalizeTextField(body.name, leadFieldLimits.name),
    business: normalizeTextField(body.business, leadFieldLimits.business),
    phone: normalizeTextField(body.phone, leadFieldLimits.phone),
    service: normalizeTextField(body.service, leadFieldLimits.service),
    message: normalizeTextField(body.message, leadFieldLimits.message),
    source: normalizeTextField(body.source, leadFieldLimits.source) || "landing",
    timestamp: new Date().toISOString(),
  };
}

function validateInquiry(inquiry) {
  const missingFields = [];
  if (inquiry.name.length < 2) missingFields.push("name");
  if (inquiry.business.length < 2) missingFields.push("business");
  if (inquiry.phone.replace(/\D/g, "").length < 8) missingFields.push("phone");
  if (!inquiry.service) missingFields.push("service");
  return missingFields;
}

function buildPublicInquiryResponse(stored) {
  return {
    ok: true,
    inquiryId: stored.inquiry.id,
  };
}

async function sendContactWebhook(inquiry) {
  const { webhookUrl, webhookToken } = getContactEnv();
  if (!webhookUrl) {
    return {
      status: "not_configured",
      destination: null,
    };
  }
  if (isProduction() && !webhookToken) {
    return { status: "failed", destination: null };
  }

  try {
    const webhookResponse = await fetchWithTimeout(
      getSecureOutboundUrl(webhookUrl, "Contact webhook URL"),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(webhookToken ? { Authorization: `Bearer ${webhookToken}` } : {}),
        },
        body: JSON.stringify(inquiry),
      },
      CONTACT_WEBHOOK_TIMEOUT_MS,
    );
    return {
      status: webhookResponse.ok ? "sent" : "failed",
      destination: webhookUrl,
      httpStatus: webhookResponse.status,
    };
  } catch (error) {
    return {
      status: "failed",
      destination: webhookUrl,
      error: error.message,
    };
  }
}

export async function deliverQueuedContactInquiries({ limit = 10, inquiryId = null } = {}) {
  const claims = await claimContactDeliveries({ limit, inquiryId });
  const results = [];
  for (const claim of claims) {
    const webhook = await sendContactWebhook(claim.inquiry);
    const succeeded = webhook.status === "sent";
    await completeContactDelivery({
      deliveryId: claim.deliveryId,
      succeeded,
      httpStatus: webhook.httpStatus || null,
    });
    results.push({
      deliveryId: claim.deliveryId,
      status: succeeded ? "sent" : "queued",
    });
  }
  return results;
}

export async function capturePublicInquiry(inquiry) {
  const stored = await storePublicInquiry(inquiry);
  let webhook = { status: "queued" };
  try {
    const [delivery] = await deliverQueuedContactInquiries({
      limit: 1,
      inquiryId: stored.inquiry.id,
    });
    if (delivery?.status === "sent") webhook = { status: "sent" };
  } catch {
    // Persistence has already succeeded; the worker will retry delivery.
  }

  return {
    ...stored,
    webhook,
  };
}

export async function capturePublicInquiryFromBody(body = {}, context = {}) {
  await validatePublicInquirySecurity({
    body,
    clientIp: context.clientIp,
  });
  const inquiry = normalizeInquiry(body);
  const missingFields = validateInquiry(inquiry);

  if (missingFields.length) {
    throw new PublicInquiryValidationError(missingFields);
  }

  const stored = await capturePublicInquiry(inquiry);

  return {
    ...stored,
    publicResponse: buildPublicInquiryResponse(stored),
  };
}
