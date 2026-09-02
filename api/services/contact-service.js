import {
  claimContactDeliveries,
  completeContactDelivery,
  storePublicInquiry,
} from "../../db/storage.js";
import { getContactEnv } from "../../config/env.js";
import { generateRecordId, leadFieldLimits, normalizeTextField } from "../../core/engine.js";
import { validatePublicInquirySecurity } from "./turnstile-service.js";
import { deliverWebhook } from "./webhook-delivery.js";

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
    email: normalizeTextField(body.email, leadFieldLimits.email).toLowerCase(),
    service: normalizeTextField(body.service, leadFieldLimits.service),
    message: normalizeTextField(body.message, leadFieldLimits.message),
    source: normalizeTextField(body.source, leadFieldLimits.source) || "landing",
    timestamp: new Date().toISOString(),
  };
}

// WhatsApp sigue siendo el canal obligatorio: es como opera el negocio. El correo
// es opcional y solo se rechaza si viene y está mal formado, para no descartar un
// lead válido por un campo que nadie estaba obligado a llenar.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validateInquiry(inquiry) {
  const missingFields = [];
  if (inquiry.name.length < 2) missingFields.push("name");
  if (inquiry.business.length < 2) missingFields.push("business");
  if (inquiry.phone.replace(/\D/g, "").length < 8) missingFields.push("phone");
  if (!inquiry.service) missingFields.push("service");
  if (inquiry.email && !EMAIL_PATTERN.test(inquiry.email)) missingFields.push("email");
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
  const result = await deliverWebhook({
    url: webhookUrl,
    token: webhookToken,
    payload: inquiry,
    urlLabel: "Contact webhook URL",
    timeoutMs: CONTACT_WEBHOOK_TIMEOUT_MS,
  });

  if (result.status === "not_configured") {
    return { status: "not_configured", destination: null };
  }
  if (result.reason === "missing_token") {
    return { status: "failed", destination: null };
  }
  if (result.reason === "network_error") {
    return {
      status: "failed",
      destination: webhookUrl,
      error: result.errorMessage,
    };
  }

  return {
    status: result.status,
    destination: webhookUrl,
    httpStatus: result.httpStatus,
  };
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
