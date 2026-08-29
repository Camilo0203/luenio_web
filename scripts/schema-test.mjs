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
  assert(tableCount.rows[0]?.count === 17, "The applied schema must create all 17 public tables.");

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
