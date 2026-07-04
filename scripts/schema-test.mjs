import fs from "node:fs";
import path from "node:path";

const schema = fs
  .readFileSync(path.join(process.cwd(), "supabase", "schema.sql"), "utf8")
  .toLowerCase();

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

console.info("Supabase schema guard passed");
