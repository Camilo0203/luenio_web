import crypto from "node:crypto";
import { getInvitationEnv, getServerConfig, isProduction } from "../../config/env.js";
import { generateRecordId } from "../../core/ids.js";
import {
  getSupabaseConfig,
  readLocalState,
  supabaseRequest,
  writeLocalState,
} from "../../db/storage.js";
import { createPasswordHash, createUser, findUserByEmail } from "./auth-service.js";
import { fetchWithTimeout, getSecureOutboundUrl } from "./outbound-request.js";

const invitationTtlMs = 72 * 60 * 60 * 1_000;

function normalizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .slice(0, 254);
}

function normalizeText(value, limit = 120) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function tokenHash(token) {
  return crypto
    .createHash("sha256")
    .update(String(token || ""))
    .digest("hex");
}

function publicInvitation(invitation) {
  return {
    id: invitation.id,
    email: invitation.email,
    businessId: invitation.businessId || invitation.business_id,
    businessName: invitation.businessName || invitation.business_name,
    role: invitation.role,
    status: invitation.status,
    expiresAt: invitation.expiresAt || invitation.expires_at,
    createdAt: invitation.createdAt || invitation.created_at,
  };
}

function isAdmin(user) {
  const configuredAdmins = getInvitationEnv().adminEmails;
  if (user?.role === "admin") return true;
  return !isProduction() && configuredAdmins.includes(String(user?.email || "").toLowerCase());
}

export function requireAdminUser(user) {
  if (!user || !isAdmin(user)) {
    const error = new Error("Administrator access required.");
    error.statusCode = 403;
    throw error;
  }
  return user;
}

async function audit({ businessId, actorUserId, action, targetId, metadata = {} }) {
  const record = {
    id: generateRecordId("audit"),
    businessId,
    actorUserId,
    action,
    targetId,
    metadata,
    createdAt: new Date().toISOString(),
  };
  if (getSupabaseConfig()) {
    await supabaseRequest("audit_logs", {
      method: "POST",
      body: JSON.stringify({
        id: record.id,
        business_id: record.businessId,
        actor_user_id: record.actorUserId,
        action: record.action,
        target_id: record.targetId,
        metadata: record.metadata,
        created_at: record.createdAt,
      }),
    });
  } else {
    const database = readLocalState();
    writeLocalState({ ...database, auditLogs: [record, ...(database.auditLogs || [])] });
  }
}

async function ensureBusiness({ businessId, businessName }) {
  const id = businessId || generateRecordId("business");
  if (getSupabaseConfig()) {
    const existing = await supabaseRequest(
      `businesses?id=eq.${encodeURIComponent(id)}&select=id&limit=1`,
    );
    if (!existing.length) {
      await supabaseRequest("businesses", {
        method: "POST",
        body: JSON.stringify({ id, name: businessName }),
      });
    }
  } else {
    const database = readLocalState();
    if (!(database.businesses || []).some((business) => business.id === id)) {
      writeLocalState({
        ...database,
        businesses: [
          { id, name: businessName, createdAt: new Date().toISOString() },
          ...(database.businesses || []),
        ],
      });
    }
  }
  return id;
}

async function deliverInvitation(invitation, acceptanceUrl) {
  const { webhookUrl, webhookToken } = getInvitationEnv();
  if (!webhookUrl) return { status: "not_configured" };
  if (isProduction() && !webhookToken) return { status: "failed" };
  try {
    const response = await fetchWithTimeout(
      getSecureOutboundUrl(webhookUrl, "Invitation webhook URL"),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(webhookToken ? { Authorization: `Bearer ${webhookToken}` } : {}),
        },
        body: JSON.stringify({
          invitationId: invitation.id,
          email: invitation.email,
          businessName: invitation.businessName,
          role: invitation.role,
          acceptanceUrl,
          expiresAt: invitation.expiresAt,
        }),
      },
    );
    return { status: response.ok ? "sent" : "failed", httpStatus: response.status };
  } catch {
    return { status: "failed" };
  }
}

export async function createInvitation({ body = {}, actor }) {
  requireAdminUser(actor);
  const email = normalizeEmail(body.email);
  const businessName = normalizeText(body.businessName);
  const role = body.role === "admin" ? "admin" : "client";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("A valid email is required.");
  if (businessName.length < 2) throw new Error("Business name is required.");
  if (await findUserByEmail(email)) throw new Error("A user with this email already exists.");

  const businessId = await ensureBusiness({
    businessId: normalizeText(body.businessId, 160) || undefined,
    businessName,
  });
  const rawToken = crypto.randomBytes(32).toString("base64url");
  const invitation = {
    id: generateRecordId("invite"),
    email,
    businessId,
    businessName,
    role,
    tokenHash: tokenHash(rawToken),
    status: "pending",
    expiresAt: new Date(Date.now() + invitationTtlMs).toISOString(),
    invitedBy: actor.id,
    createdAt: new Date().toISOString(),
  };

  if (getSupabaseConfig()) {
    await supabaseRequest("invitations", {
      method: "POST",
      body: JSON.stringify({
        id: invitation.id,
        email: invitation.email,
        business_id: invitation.businessId,
        business_name: invitation.businessName,
        role: invitation.role,
        token_hash: invitation.tokenHash,
        status: invitation.status,
        expires_at: invitation.expiresAt,
        invited_by: invitation.invitedBy,
        created_at: invitation.createdAt,
      }),
    });
  } else {
    const database = readLocalState();
    writeLocalState({ ...database, invitations: [invitation, ...(database.invitations || [])] });
  }

  const appUrl = getServerConfig().appUrl || "http://127.0.0.1:4180";
  const acceptanceUrl = new URL(
    `/aceptar-invitacion#token=${encodeURIComponent(rawToken)}`,
    appUrl,
  ).toString();
  const delivery = await deliverInvitation(invitation, acceptanceUrl);
  await audit({
    businessId,
    actorUserId: actor.id,
    action: "invitation.created",
    targetId: invitation.id,
    metadata: { role, delivery: delivery.status },
  });
  return { invitation: publicInvitation(invitation), acceptanceUrl, delivery };
}

export async function listInvitations(actor) {
  requireAdminUser(actor);
  const records = getSupabaseConfig()
    ? await supabaseRequest("invitations?select=*&order=created_at.desc")
    : readLocalState().invitations || [];
  return records.map(publicInvitation);
}

async function findInvitationByToken(rawToken) {
  const hash = tokenHash(rawToken);
  if (getSupabaseConfig()) {
    const [record] = await supabaseRequest(
      `invitations?token_hash=eq.${encodeURIComponent(hash)}&select=*&limit=1`,
    );
    return record || null;
  }
  return (readLocalState().invitations || []).find((item) => item.tokenHash === hash) || null;
}

export async function acceptInvitation({ token, password }) {
  const rawToken = String(token || "");
  if (rawToken.length < 32 || rawToken.length > 256) throw new Error("Invitation is invalid.");

  if (getSupabaseConfig()) {
    const preliminaryInvitation = await findInvitationByToken(rawToken);
    if (!preliminaryInvitation) throw new Error("Invitation is invalid.");
    const preliminary = publicInvitation(preliminaryInvitation);
    if (preliminary.status !== "pending") throw new Error("Invitation is no longer available.");
    if (new Date(preliminary.expiresAt).getTime() <= Date.now())
      throw new Error("Invitation has expired.");
    const userId = generateRecordId("user");
    const membershipId = generateRecordId("membership");
    const acceptedAt = new Date().toISOString();
    try {
      const [record] = await supabaseRequest("rpc/luenio_accept_invitation", {
        method: "POST",
        body: JSON.stringify({
          p_token_hash: tokenHash(rawToken),
          p_user_id: userId,
          p_password_hash: await createPasswordHash(password),
          p_membership_id: membershipId,
          p_now: acceptedAt,
        }),
      });
      if (!record) throw new Error("Invitation is invalid.");
      const user = {
        id: record.accepted_user_id,
        email: record.accepted_email,
        businessName: record.accepted_business_name,
        plan: record.accepted_plan,
        role: record.accepted_role,
        businessId: record.accepted_business_id,
        createdAt: record.accepted_created_at,
      };
      await audit({
        businessId: user.businessId,
        actorUserId: user.id,
        action: "invitation.accepted",
        targetId: record.accepted_invitation_id,
      });
      return user;
    } catch (error) {
      if (error.databaseCode === "INVITATION_EXPIRED") throw new Error("Invitation has expired.");
      if (error.databaseCode === "INVITATION_UNAVAILABLE")
        throw new Error("Invitation is no longer available.");
      if (error.databaseCode === "INVITATION_USER_EXISTS")
        throw new Error("A user with this email already exists.");
      if (error.databaseCode === "INVITATION_INVALID") throw new Error("Invitation is invalid.");
      throw error;
    }
  }

  const invitation = await findInvitationByToken(token);
  if (!invitation) throw new Error("Invitation is invalid.");
  const normalized = publicInvitation(invitation);
  if (normalized.status !== "pending") throw new Error("Invitation is no longer available.");
  if (new Date(normalized.expiresAt).getTime() <= Date.now())
    throw new Error("Invitation has expired.");

  const user = await createUser({
    email: normalized.email,
    password,
    businessName: normalized.businessName,
    role: normalized.role,
    businessId: normalized.businessId,
  });
  const acceptedAt = new Date().toISOString();
  const database = readLocalState();
  writeLocalState({
    ...database,
    invitations: (database.invitations || []).map((item) =>
      item.id === normalized.id ? { ...item, status: "accepted", acceptedAt } : item,
    ),
    memberships: [
      {
        id: generateRecordId("membership"),
        businessId: normalized.businessId,
        userId: user.id,
        role: normalized.role,
        createdAt: acceptedAt,
      },
      ...(database.memberships || []),
    ],
  });
  await audit({
    businessId: normalized.businessId,
    actorUserId: user.id,
    action: "invitation.accepted",
    targetId: normalized.id,
  });
  return user;
}

export async function revokeInvitation({ invitationId, actor }) {
  requireAdminUser(actor);
  const id = normalizeText(invitationId, 180);
  if (!id) throw new Error("Invitation ID is required.");
  const revokedAt = new Date().toISOString();
  if (getSupabaseConfig()) {
    await supabaseRequest(`invitations?id=eq.${encodeURIComponent(id)}&status=eq.pending`, {
      method: "PATCH",
      body: JSON.stringify({ status: "revoked", revoked_at: revokedAt }),
    });
  } else {
    const database = readLocalState();
    writeLocalState({
      ...database,
      invitations: (database.invitations || []).map((item) =>
        item.id === id && item.status === "pending"
          ? { ...item, status: "revoked", revokedAt }
          : item,
      ),
    });
  }
  await audit({ actorUserId: actor.id, action: "invitation.revoked", targetId: id });
  return { id, status: "revoked" };
}
