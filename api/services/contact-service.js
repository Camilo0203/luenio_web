import { storePublicInquiry } from "../../db/storage.js";
import { getContactEnv } from "../../config/env.js";
import { generateRecordId, leadFieldLimits, normalizeTextField } from "../../core/engine.js";

export class PublicInquiryValidationError extends Error {
  constructor(missingFields) {
    super("Missing required fields");
    this.name = "PublicInquiryValidationError";
    this.statusCode = 400;
    this.code = "VALIDATION_ERROR";
    this.missingFields = missingFields;
  }
}

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

function sanitizeWebhookResult(webhook) {
  if (!webhook) return { status: "unknown" };

  return {
    status: webhook.status || "unknown",
    ...(webhook.httpStatus ? { httpStatus: webhook.httpStatus } : {}),
  };
}

function buildPublicInquiryResponse(stored) {
  return {
    ok: true,
    inquiryId: stored.inquiry.id,
    storage: stored.storage,
    webhook: sanitizeWebhookResult(stored.webhook),
  };
}

async function sendContactWebhook(inquiry) {
  const webhookUrl = getContactEnv().webhookUrl;
  if (!webhookUrl) {
    return {
      status: "not_configured",
      destination: null,
    };
  }

  try {
    const webhookResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(inquiry),
    });

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

export async function capturePublicInquiry(inquiry) {
  const stored = await storePublicInquiry(inquiry);
  const webhook = await sendContactWebhook(stored.inquiry);

  return {
    ...stored,
    webhook,
  };
}

export async function capturePublicInquiryFromBody(body = {}) {
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
