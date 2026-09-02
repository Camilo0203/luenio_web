import { listCrmData, listWorkspaceMembers } from "../../db/storage.js";
import { leadMatchesQuery } from "./lead-validation-service.js";

export async function listCrmWorkspace(user, { q = "", limit = 200, cursor = "" } = {}) {
  const tenantId = user.businessId || user.id;
  const data = await listCrmData(tenantId);
  const members = await listWorkspaceMembers(tenantId);
  const { storage: _storage, ...workspace } = data;
  const query = String(q || "")
    .trim()
    .toLowerCase()
    .slice(0, 80);
  const safeLimit = Math.min(Math.max(Number(limit) || 200, 1), 500);

  let leads = Array.isArray(workspace.leads) ? [...workspace.leads] : [];
  if (query) {
    leads = leads.filter((lead) => leadMatchesQuery(lead, query));
  }

  // Stable order: newest first when timestamps exist
  leads.sort((a, b) => {
    const ta = new Date(a.created_at || a.timestamp || 0).getTime();
    const tb = new Date(b.created_at || b.timestamp || 0).getTime();
    return tb - ta;
  });

  let start = 0;
  if (cursor) {
    const index = leads.findIndex((lead) => lead.id === cursor);
    start = index >= 0 ? index + 1 : 0;
  }
  const page = leads.slice(start, start + safeLimit);
  const nextCursor = start + safeLimit < leads.length ? page[page.length - 1]?.id || null : null;

  // Ensure current user appears in the assignee list even on sparse local DB.
  const memberMap = new Map(members.map((member) => [member.id, member]));
  if (user?.id && !memberMap.has(user.id)) {
    memberMap.set(user.id, {
      id: user.id,
      email: user.email || "",
      role: user.role || "client",
      businessName: user.businessName || "",
    });
  }

  return {
    ok: true,
    ...workspace,
    leads: page,
    members: [...memberMap.values()],
    pagination: {
      total: leads.length,
      limit: safeLimit,
      cursor: cursor || null,
      nextCursor,
      q: query || null,
    },
  };
}
