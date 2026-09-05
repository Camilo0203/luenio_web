import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";

const schemaSource = fs.readFileSync(path.join(process.cwd(), "supabase", "schema.sql"), "utf8");
const schema = schemaSource.toLowerCase();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

[
  "users",
  "pipeline_stages",
  "leads",
  "events",
  "lead_actions",
  "lead_notifications",
  "subscriptions",
  "contact_inquiries",
  "contact_deliveries",
  "businesses",
  "memberships",
  "invitations",
  "audit_logs",
  "password_resets",
  "sessions",
  "auth_throttles",
  "auth_challenges",
  "automation_deliveries",
].forEach((table) => {
  assert(
    schema.includes(`create table if not exists public.${table}`),
    `Supabase schema must create ${table}.`,
  );
});

[
  "users_plan_check",
  "leads_score_range_check",
  "leads_classification_check",
  "leads_status_check",
  "leads_pipeline_stage_check",
  "lead_actions_score_range_check",
  "lead_actions_classification_check",
  "lead_actions_pipeline_stage_check",
  "subscriptions_plan_check",
  "users_role_check",
  "memberships_role_check",
  "invitations_role_check",
  "invitations_status_check",
  "password_resets_status_check",
  "auth_throttles_failures_check",
  "auth_challenges_status_check",
  "auth_challenges_attempts_check",
  "contact_deliveries_status_check",
  "contact_deliveries_attempts_check",
  "contact_deliveries_http_status_check",
  "automation_deliveries_status_check",
  "automation_deliveries_attempts_check",
  "automation_deliveries_http_status_check",
  "users_business_id_fkey",
].forEach((constraint) => {
  assert(schema.includes(constraint), `Supabase schema must include ${constraint}.`);
});

[
  "users_email_idx",
  "leads_user_created_at_idx",
  "leads_user_phone_created_at_idx",
  "events_user_created_at_idx",
  "lead_actions_user_created_at_idx",
  "lead_notifications_user_created_at_idx",
  "subscriptions_user_idx",
  "contact_inquiries_phone_created_at_idx",
  "contact_deliveries_due_idx",
  "contact_deliveries_locked_idx",
  "automation_deliveries_due_idx",
  "automation_deliveries_locked_idx",
  "automation_deliveries_lead_idx",
  "users_business_id_idx",
  "memberships_business_id_idx",
  "invitations_business_status_idx",
  "invitations_expires_at_idx",
  "audit_logs_business_created_at_idx",
  "password_resets_user_status_idx",
  "password_resets_expires_at_idx",
  "sessions_user_active_idx",
  "sessions_expires_at_idx",
  "auth_throttles_blocked_until_idx",
  "auth_challenges_user_created_at_idx",
  "auth_challenges_expires_at_idx",
  "leads_business_created_at_idx",
  "events_business_created_at_idx",
  "lead_actions_business_created_at_idx",
  "lead_notifications_business_created_at_idx",
].forEach((index) => {
  assert(
    schema.includes(`create index if not exists ${index}`),
    `Supabase schema must include ${index}.`,
  );
});

[
  "plan in ('starter', 'pro', 'agency')",
  "classification in ('hot', 'warm', 'cold')",
  "pipeline_stage in ('new', 'qualified', 'contacted', 'converted')",
  "score between 0 and 100",
].forEach((invariant) => {
  assert(schema.includes(invariant), `Supabase schema must enforce ${invariant}.`);
});

[
  "add column if not exists notes text not null default ''",
  "add column if not exists tags jsonb not null default '[]'::jsonb",
  "add column if not exists next_action text not null default ''",
  "add column if not exists next_action_at timestamptz",
  "add column if not exists last_contacted_at timestamptz",
  "add column if not exists contact_log jsonb not null default '[]'::jsonb",
  "add column if not exists assignee_user_id",
].forEach((column) => {
  assert(
    schema.toLowerCase().includes(column.toLowerCase()),
    `Supabase schema must include lead CRM column: ${column}`,
  );
});

assert(
  fs.existsSync(path.join(process.cwd(), "supabase", "migrations", "20260722_lead_ops.sql")),
  "Versioned migration for lead ops fields must exist.",
);
assert(
  fs.existsSync(path.join(process.cwd(), "supabase", "migrations", "20260722_lead_assignee.sql")),
  "Versioned migration for lead assignee must exist.",
);

[
  "luenio_register_auth_failure",
  "luenio_accept_invitation",
  "luenio_consume_password_reset",
  "luenio_store_contact_inquiry",
  "luenio_claim_contact_deliveries",
  "luenio_complete_contact_delivery",
  "luenio_consume_mfa_challenge",
  "luenio_security_maintenance",
  "luenio_store_crm_record",
  "luenio_claim_automation_deliveries",
  "luenio_complete_automation_delivery",
  "alter column business_id set not null",
  "enable row level security",
  "force row level security",
  "revoke all on table",
  "from anon, authenticated",
  "grant all on table",
  "to service_role",
].forEach((securityInvariant) => {
  assert(
    schema.includes(securityInvariant),
    `Supabase schema must enforce security invariant: ${securityInvariant}.`,
  );
});

const database = new PGlite();
try {
  await database.exec(
    "create role anon; create role authenticated; create role service_role with bypassrls;",
  );
  await database.exec(schemaSource);

  const tableCount = await database.query(
    "select count(*)::int as count from pg_tables where schemaname = 'public'",
  );
  assert(tableCount.rows[0]?.count === 18, "The applied schema must create all 18 public tables.");

  await database.exec(`
    insert into public.businesses (id, name) values ('business_test', 'Test Business');
    insert into public.users (
      id, email, business_name, plan, password_hash, role, business_id
    ) values (
      'user_admin', 'admin@example.test', 'Test Business', 'starter',
      'pbkdf2-sha256$600000$abcdefghijklmnop$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      'admin', 'business_test'
    );
  `);

  const storedInquiry = await database.query(`
    select * from public.luenio_store_contact_inquiry(
      'inquiry_test', 'delivery_test', 'Camilo Test', 'Test Business', '+57 300 000 0000',
      '573000000000', 'camilo@example.test', 'Automation', 'Secure delivery test',
      'schema_test', now(), 90
    )
  `);
  assert(storedInquiry.rows.length === 1, "Contact inquiry and outbox creation must be atomic.");
  assert(
    storedInquiry.rows[0]?.email === "camilo@example.test",
    "The optional contact email must persist with the inquiry.",
  );

  const claimed = await database.query(`
    select * from public.luenio_claim_contact_deliveries(now(), 10, 300, 'inquiry_test')
  `);
  assert(
    claimed.rows[0]?.delivery_id === "delivery_test" && claimed.rows[0]?.delivery_attempts === 1,
    "Contact delivery claims must be atomic and increment attempts.",
  );
  // Un reintento debe poder entregar el correo: si no viaja en la reclamación,
  // se pierde justo en el caso en que el webhook falló la primera vez.
  assert(
    claimed.rows[0]?.inquiry_email === "camilo@example.test",
    "A retried delivery must carry the optional email to the webhook.",
  );
  const completed = await database.query(`
    select * from public.luenio_complete_contact_delivery('delivery_test', true, 200, now())
  `);
  assert(
    completed.rows[0]?.delivery_status === "sent",
    "Contact delivery completion must persist terminal state.",
  );

  // luenio_store_crm_record: one transactional write for lead + action +
  // notification + N events + N automation_deliveries, replacing what used
  // to be 4 sequential HTTP calls from db/storage.js.
  const storedCrm = await database.query(`
    select * from public.luenio_store_crm_record(
      '{"id":"lead_test","business_id":"business_test","name":"Ana","business":"Nova","phone":"+573001112233","phone_normalized":"573001112233","service":"CRM","classification":"hot","status":"new","pipeline_stage":"new","score":90}'::jsonb,
      '{"id":"action_test","business_id":"business_test","lead_id":"lead_test","workflow":"hot_lead_workflow","actions":["send_webhook","send_crm_webhook"],"integration_results":[{"label":"webhook","status":"queued"},{"label":"crm_webhook","status":"queued"}]}'::jsonb,
      '{"id":"notification_test","business_id":"business_test","lead_id":"lead_test","summary":"New hot lead"}'::jsonb,
      '[{"id":"event_test","business_id":"business_test","lead_id":"lead_test","type":"lead.created","payload":{}}]'::jsonb,
      '[{"id":"automation_delivery_lead_test_send_webhook","lead_id":"lead_test","business_id":"business_test","action":"send_webhook","payload":{"leadId":"lead_test"}},{"id":"automation_delivery_lead_test_send_crm_webhook","lead_id":"lead_test","business_id":"business_test","action":"send_crm_webhook","payload":{"leadId":"lead_test"}}]'::jsonb
    )
  `);
  assert(storedCrm.rows.length === 1, "luenio_store_crm_record must return the stored lead.");
  assert(storedCrm.rows[0]?.name === "Ana", "The stored lead must persist its fields.");
  const storedEvent = await database.query(
    "select count(*)::int as n from public.events where lead_id = 'lead_test'",
  );
  assert(
    storedEvent.rows[0]?.n === 1,
    "luenio_store_crm_record must persist events atomically with the lead.",
  );
  const storedDeliveries = await database.query(
    "select count(*)::int as n from public.automation_deliveries where lead_id = 'lead_test' and status = 'pending'",
  );
  assert(
    storedDeliveries.rows[0]?.n === 2,
    "luenio_store_crm_record must queue one automation_deliveries row per configured action.",
  );

  let duplicateDeliveryRejected = false;
  try {
    await database.query(`
      insert into public.automation_deliveries (id, lead_id, business_id, action)
      values ('automation_delivery_lead_test_send_webhook_dup', 'lead_test', 'business_test', 'send_webhook')
    `);
  } catch {
    duplicateDeliveryRejected = true;
  }
  assert(
    duplicateDeliveryRejected,
    "unique(lead_id, action) must reject a second delivery row for the same (lead, action) pair.",
  );

  const claimedAutomation = await database.query(`
    select * from public.luenio_claim_automation_deliveries(now(), 10, 300, 'lead_test')
  `);
  assert(
    claimedAutomation.rows.length === 2,
    "Both queued deliveries for the lead must be claimable.",
  );
  assert(
    claimedAutomation.rows.every((row) => row.delivery_attempts === 1),
    "Claiming must increment attempts atomically.",
  );
  assert(
    claimedAutomation.rows.every((row) => row.payload?.leadId === "lead_test"),
    "A retried delivery must carry its payload.",
  );

  const sentDelivery = claimedAutomation.rows[0].delivery_id;
  const failedDelivery = claimedAutomation.rows[1].delivery_id;

  const completedSent = await database.query(
    `select * from public.luenio_complete_automation_delivery('${sentDelivery}', true, 200, now())`,
  );
  assert(
    completedSent.rows[0]?.delivery_status === "sent",
    "A successful delivery must reach terminal state 'sent'.",
  );

  const completedRetry = await database.query(
    `select * from public.luenio_complete_automation_delivery('${failedDelivery}', false, 503, now())`,
  );
  assert(
    completedRetry.rows[0]?.delivery_status === "retry",
    "A failed delivery under the attempt cap must be requeued as 'retry', not dropped.",
  );
  const retriedRow = await database.query(
    `select next_attempt_at > now() as backoff_applied from public.automation_deliveries where id = '${failedDelivery}'`,
  );
  assert(
    retriedRow.rows[0]?.backoff_applied,
    "A retry must push next_attempt_at into the future (backoff).",
  );

  let invalidClaimRejected = false;
  try {
    await database.query(
      "select * from public.luenio_claim_automation_deliveries(now(), 999, 300, null)",
    );
  } catch {
    invalidClaimRejected = true;
  }
  assert(invalidClaimRejected, "An out-of-range claim limit must be rejected.");

  await database.exec(`
    insert into public.invitations (
      id, email, business_id, business_name, role, token_hash, status, expires_at, invited_by
    ) values (
      'invite_test', 'client@example.test', 'business_test', 'Test Business', 'client',
      repeat('b', 64), 'pending', now() + interval '1 hour', 'user_admin'
    );
  `);
  const accepted = await database.query(`
    select * from public.luenio_accept_invitation(
      repeat('b', 64), 'user_client',
      'pbkdf2-sha256$600000$abcdefghijklmnop$bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      'membership_test', now()
    )
  `);
  assert(
    accepted.rows[0]?.accepted_user_id === "user_client",
    "Invitation acceptance must complete atomically.",
  );
  let invitationReuseRejected = false;
  try {
    await database.query(`
      select * from public.luenio_accept_invitation(
        repeat('b', 64), 'user_duplicate',
        'pbkdf2-sha256$600000$abcdefghijklmnop$bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        'membership_duplicate', now()
      )
    `);
  } catch {
    invitationReuseRejected = true;
  }
  assert(invitationReuseRejected, "An accepted invitation must not be reusable.");

  await database.exec(`
    insert into public.sessions (
      id, user_id, token_hash, ip_hash, user_agent_hash, expires_at
    ) values (
      'session_test', 'user_client', repeat('c', 64), repeat('d', 64), repeat('e', 64),
      now() + interval '1 hour'
    );
    insert into public.password_resets (
      id, user_id, token_hash, status, expires_at
    ) values (
      'reset_test', 'user_client', repeat('f', 64), 'pending', now() + interval '1 hour'
    );
  `);
  const reset = await database.query(`
    select * from public.luenio_consume_password_reset(
      repeat('f', 64),
      'pbkdf2-sha256$600000$abcdefghijklmnop$cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      now()
    )
  `);
  assert(
    reset.rows[0]?.updated_user_id === "user_client",
    "Password reset consumption must update exactly one user.",
  );
  const revokedSession = await database.query(
    "select revoked_at is not null as revoked from public.sessions where id = 'session_test'",
  );
  assert(revokedSession.rows[0]?.revoked, "Password resets must revoke active sessions.");

  await database.exec(`
    insert into public.auth_challenges (
      id, user_id, code_hash, status, attempts, expires_at
    ) values (
      'challenge_test', 'user_admin', repeat('1', 64), 'pending', 0,
      now() + interval '10 minutes'
    );
  `);
  const mfa = await database.query(`
    select * from public.luenio_consume_mfa_challenge(
      'challenge_test', repeat('1', 64), now(), 5
    )
  `);
  assert(
    mfa.rows[0]?.verification_result === "verified",
    "MFA challenges must be consumed atomically.",
  );

  let anonymousAccessDenied = false;
  await database.exec("set role anon");
  try {
    await database.query("select * from public.users");
  } catch {
    anonymousAccessDenied = true;
  } finally {
    await database.exec("reset role");
  }
  assert(anonymousAccessDenied, "Anonymous database access must be denied.");
} finally {
  await database.close();
}

console.info("Supabase schema guard passed");
