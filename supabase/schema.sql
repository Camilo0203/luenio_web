create table if not exists public.users (
  id text primary key,
  email text not null unique,
  business_name text not null,
  plan text not null default 'starter',
  password_hash text not null,
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text not null default 'trialing',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.users add column if not exists role text not null default 'client';
alter table public.users add column if not exists business_id text;

create table if not exists public.businesses (
  id text primary key,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.memberships (
  id text primary key,
  business_id text not null references public.businesses(id) on delete cascade,
  user_id text not null references public.users(id) on delete cascade,
  role text not null default 'client',
  created_at timestamptz not null default now(),
  unique (business_id, user_id)
);

create table if not exists public.invitations (
  id text primary key,
  email text not null,
  business_id text not null references public.businesses(id) on delete cascade,
  business_name text not null,
  role text not null default 'client',
  token_hash text not null unique,
  status text not null default 'pending',
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  invited_by text not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id text primary key,
  business_id text,
  actor_user_id text references public.users(id) on delete set null,
  action text not null,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.password_resets (
  id text primary key,
  user_id text not null references public.users(id) on delete cascade,
  token_hash text not null unique,
  status text not null default 'pending',
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.sessions (
  id text primary key,
  user_id text not null references public.users(id) on delete cascade,
  token_hash text not null unique,
  ip_hash text not null,
  user_agent_hash text not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists public.auth_throttles (
  key_hash text primary key,
  failures integer not null default 0,
  window_started_at timestamptz not null default now(),
  blocked_until timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.auth_challenges (
  id text primary key,
  user_id text not null references public.users(id) on delete cascade,
  code_hash text not null,
  status text not null default 'pending',
  attempts integer not null default 0,
  expires_at timestamptz not null,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.pipeline_stages (
  id text primary key,
  user_id text not null references public.users(id) on delete cascade,
  name text not null,
  position integer not null,
  created_at timestamptz not null default now()
);

create table if not exists public.leads (
  id text primary key,
  user_id text not null references public.users(id) on delete cascade,
  name text not null,
  business text not null,
  phone text not null,
  phone_normalized text,
  service text not null,
  message text,
  source text,
  notes text not null default '',
  tags jsonb not null default '[]'::jsonb,
  next_action text not null default '',
  next_action_at timestamptz,
  last_contacted_at timestamptz,
  contact_log jsonb not null default '[]'::jsonb,
  assignee_user_id text references public.users(id) on delete set null,
  score integer not null default 0,
  classification text not null default 'cold',
  status text not null default 'new',
  pipeline_stage text not null default 'new',
  score_reasons jsonb not null default '[]'::jsonb,
  workflow text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.leads add column if not exists notes text not null default '';
alter table public.leads add column if not exists tags jsonb not null default '[]'::jsonb;
alter table public.leads add column if not exists next_action text not null default '';
alter table public.leads add column if not exists next_action_at timestamptz;
alter table public.leads add column if not exists last_contacted_at timestamptz;
alter table public.leads add column if not exists contact_log jsonb not null default '[]'::jsonb;
alter table public.leads add column if not exists assignee_user_id text references public.users(id) on delete set null;

create table if not exists public.events (
  id text primary key,
  user_id text not null references public.users(id) on delete cascade,
  lead_id text references public.leads(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.lead_actions (
  id text primary key,
  user_id text not null references public.users(id) on delete cascade,
  lead_id text not null references public.leads(id) on delete cascade,
  workflow text not null,
  segment text,
  actions jsonb not null default '[]'::jsonb,
  score integer,
  classification text,
  pipeline_stage text,
  score_reasons jsonb not null default '[]'::jsonb,
  restricted_actions jsonb not null default '[]'::jsonb,
  integration_results jsonb not null default '[]'::jsonb,
  internal_action_results jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.lead_notifications (
  id text primary key,
  user_id text not null references public.users(id) on delete cascade,
  lead_id text not null references public.leads(id) on delete cascade,
  workflow text,
  classification text,
  summary text,
  created_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id text primary key,
  user_id text not null references public.users(id) on delete cascade,
  plan text not null,
  status text not null default 'trialing',
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contact_inquiries (
  id text primary key,
  name text not null,
  business text not null,
  phone text not null,
  phone_normalized text,
  email text,
  service text not null,
  message text,
  source text,
  created_at timestamptz not null default now()
);

create table if not exists public.contact_deliveries (
  id text primary key,
  inquiry_id text not null unique references public.contact_inquiries(id) on delete cascade,
  status text not null default 'pending',
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  locked_until timestamptz,
  delivered_at timestamptz,
  last_http_status integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Persist-then-deliver queue for internal CRM automation (send_webhook,
-- send_crm_webhook, send_whatsapp_notification, send_email_notification).
-- Same shape as contact_deliveries, fanned out to up to 4 rows per lead
-- (one per configured integration target) via unique(lead_id, action).
create table if not exists public.automation_deliveries (
  id text primary key,
  lead_id text not null references public.leads(id) on delete cascade,
  business_id text not null references public.businesses(id) on delete cascade,
  action text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  locked_until timestamptz,
  delivered_at timestamptz,
  last_http_status integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lead_id, action)
);

insert into public.businesses (id, name, created_at, updated_at)
select coalesce(nullif(users.business_id, ''), users.id), users.business_name, users.created_at, users.updated_at
from public.users
on conflict (id) do nothing;

update public.users
set business_id = users.id
where business_id is null or business_id = '';

alter table public.pipeline_stages add column if not exists business_id text references public.businesses(id) on delete cascade;
alter table public.leads add column if not exists business_id text references public.businesses(id) on delete cascade;
alter table public.events add column if not exists business_id text references public.businesses(id) on delete cascade;
alter table public.lead_actions add column if not exists business_id text references public.businesses(id) on delete cascade;
alter table public.lead_notifications add column if not exists business_id text references public.businesses(id) on delete cascade;
alter table public.pipeline_stages alter column user_id drop not null;
alter table public.leads alter column user_id drop not null;
alter table public.events alter column user_id drop not null;
alter table public.lead_actions alter column user_id drop not null;
alter table public.lead_notifications alter column user_id drop not null;

update public.pipeline_stages as record
set business_id = users.business_id
from public.users
where record.business_id is null and record.user_id = users.id;
update public.leads as record
set business_id = users.business_id
from public.users
where record.business_id is null and record.user_id = users.id;
update public.events as record
set business_id = users.business_id
from public.users
where record.business_id is null and record.user_id = users.id;
update public.lead_actions as record
set business_id = users.business_id
from public.users
where record.business_id is null and record.user_id = users.id;
update public.lead_notifications as record
set business_id = users.business_id
from public.users
where record.business_id is null and record.user_id = users.id;

alter table public.users alter column business_id set not null;
alter table public.pipeline_stages alter column business_id set not null;
alter table public.leads alter column business_id set not null;
alter table public.events alter column business_id set not null;
alter table public.lead_actions alter column business_id set not null;
alter table public.lead_notifications alter column business_id set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'users_business_id_fkey') then
    alter table public.users
      add constraint users_business_id_fkey
      foreign key (business_id) references public.businesses(id) on delete restrict;
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'users_plan_check') then
    alter table public.users
      add constraint users_plan_check check (plan in ('starter', 'pro', 'agency'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'leads_score_range_check') then
    alter table public.leads
      add constraint leads_score_range_check check (score between 0 and 100);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'leads_classification_check') then
    alter table public.leads
      add constraint leads_classification_check check (classification in ('hot', 'warm', 'cold'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'leads_status_check') then
    alter table public.leads
      add constraint leads_status_check check (status in ('new', 'qualified', 'contacted', 'converted'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'leads_pipeline_stage_check') then
    alter table public.leads
      add constraint leads_pipeline_stage_check check (pipeline_stage in ('new', 'qualified', 'contacted', 'converted'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'lead_actions_score_range_check') then
    alter table public.lead_actions
      add constraint lead_actions_score_range_check check (score is null or score between 0 and 100);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'lead_actions_classification_check') then
    alter table public.lead_actions
      add constraint lead_actions_classification_check check (classification is null or classification in ('hot', 'warm', 'cold'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'lead_actions_pipeline_stage_check') then
    alter table public.lead_actions
      add constraint lead_actions_pipeline_stage_check check (pipeline_stage is null or pipeline_stage in ('new', 'qualified', 'contacted', 'converted'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'subscriptions_plan_check') then
    alter table public.subscriptions
      add constraint subscriptions_plan_check check (plan in ('starter', 'pro', 'agency'));
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'users_role_check') then
    alter table public.users add constraint users_role_check check (role in ('client', 'admin'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'memberships_role_check') then
    alter table public.memberships add constraint memberships_role_check check (role in ('client', 'admin'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'invitations_role_check') then
    alter table public.invitations add constraint invitations_role_check check (role in ('client', 'admin'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'invitations_status_check') then
    alter table public.invitations add constraint invitations_status_check check (status in ('pending', 'accepted', 'revoked', 'expired'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'password_resets_status_check') then
    alter table public.password_resets add constraint password_resets_status_check check (status in ('pending', 'used', 'expired'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'auth_throttles_failures_check') then
    alter table public.auth_throttles add constraint auth_throttles_failures_check check (failures between 0 and 1000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'auth_challenges_status_check') then
    alter table public.auth_challenges add constraint auth_challenges_status_check check (status in ('pending', 'verified', 'locked', 'expired'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'auth_challenges_attempts_check') then
    alter table public.auth_challenges add constraint auth_challenges_attempts_check check (attempts between 0 and 20);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'contact_deliveries_status_check') then
    alter table public.contact_deliveries add constraint contact_deliveries_status_check check (status in ('pending', 'processing', 'retry', 'sent', 'dead'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'contact_deliveries_attempts_check') then
    alter table public.contact_deliveries add constraint contact_deliveries_attempts_check check (attempts between 0 and 20);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'contact_deliveries_http_status_check') then
    alter table public.contact_deliveries add constraint contact_deliveries_http_status_check check (last_http_status is null or last_http_status between 100 and 599);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'automation_deliveries_status_check') then
    alter table public.automation_deliveries add constraint automation_deliveries_status_check check (status in ('pending', 'processing', 'retry', 'sent', 'dead'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'automation_deliveries_attempts_check') then
    alter table public.automation_deliveries add constraint automation_deliveries_attempts_check check (attempts between 0 and 20);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'automation_deliveries_http_status_check') then
    alter table public.automation_deliveries add constraint automation_deliveries_http_status_check check (last_http_status is null or last_http_status between 100 and 599);
  end if;
end
$$;

create index if not exists users_email_idx on public.users(email);
create index if not exists users_business_id_idx on public.users(business_id);
create index if not exists memberships_business_id_idx on public.memberships(business_id);
create index if not exists memberships_user_id_idx on public.memberships(user_id);
create index if not exists invitations_business_status_idx on public.invitations(business_id, status);
create index if not exists invitations_email_status_idx on public.invitations(email, status);
create index if not exists invitations_expires_at_idx on public.invitations(expires_at);
create index if not exists audit_logs_business_created_at_idx on public.audit_logs(business_id, created_at desc);
create index if not exists password_resets_user_status_idx on public.password_resets(user_id, status);
create index if not exists password_resets_expires_at_idx on public.password_resets(expires_at);
create index if not exists sessions_user_active_idx on public.sessions(user_id, revoked_at, expires_at desc);
create index if not exists sessions_expires_at_idx on public.sessions(expires_at);
create index if not exists auth_throttles_blocked_until_idx on public.auth_throttles(blocked_until);
create index if not exists auth_challenges_user_created_at_idx on public.auth_challenges(user_id, created_at desc);
create index if not exists auth_challenges_expires_at_idx on public.auth_challenges(expires_at);
create index if not exists pipeline_stages_user_position_idx on public.pipeline_stages(user_id, position);
create index if not exists pipeline_stages_business_position_idx on public.pipeline_stages(business_id, position);
create index if not exists leads_user_created_at_idx on public.leads(user_id, created_at desc);
create index if not exists leads_business_created_at_idx on public.leads(business_id, created_at desc);
create index if not exists leads_business_phone_created_at_idx on public.leads(business_id, phone_normalized, created_at desc);
create index if not exists leads_business_pipeline_stage_idx on public.leads(business_id, pipeline_stage);
create index if not exists leads_user_phone_created_at_idx on public.leads(user_id, phone_normalized, created_at desc);
create index if not exists leads_user_score_idx on public.leads(user_id, score);
create index if not exists leads_user_pipeline_stage_idx on public.leads(user_id, pipeline_stage);
create index if not exists events_user_created_at_idx on public.events(user_id, created_at desc);
create index if not exists events_business_created_at_idx on public.events(business_id, created_at desc);
create index if not exists lead_actions_user_created_at_idx on public.lead_actions(user_id, created_at desc);
create index if not exists lead_actions_business_created_at_idx on public.lead_actions(business_id, created_at desc);
create index if not exists lead_notifications_user_created_at_idx on public.lead_notifications(user_id, created_at desc);
create index if not exists lead_notifications_business_created_at_idx on public.lead_notifications(business_id, created_at desc);
create index if not exists subscriptions_user_idx on public.subscriptions(user_id);
create index if not exists contact_inquiries_created_at_idx on public.contact_inquiries(created_at desc);
create index if not exists contact_inquiries_phone_created_at_idx on public.contact_inquiries(phone_normalized, created_at desc);
create index if not exists contact_deliveries_due_idx on public.contact_deliveries(status, next_attempt_at);
create index if not exists contact_deliveries_locked_idx on public.contact_deliveries(locked_until) where status = 'processing';
create index if not exists automation_deliveries_due_idx on public.automation_deliveries(status, next_attempt_at);
create index if not exists automation_deliveries_locked_idx on public.automation_deliveries(locked_until) where status = 'processing';
create index if not exists automation_deliveries_lead_idx on public.automation_deliveries(lead_id);

create or replace function public.luenio_register_auth_failure(
  p_key_hash text,
  p_now timestamptz,
  p_window_seconds integer,
  p_max_failures integer,
  p_lockout_seconds integer
)
returns setof public.auth_throttles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_key_hash is null or length(p_key_hash) <> 64 or
     p_window_seconds not between 60 and 86400 or
     p_max_failures not between 3 and 20 or
     p_lockout_seconds not between 60 and 86400 then
    raise exception 'INVALID_THROTTLE_KEY';
  end if;

  return query
  insert into public.auth_throttles as throttle (
    key_hash,
    failures,
    window_started_at,
    blocked_until,
    updated_at
  ) values (
    p_key_hash,
    1,
    p_now,
    null,
    p_now
  )
  on conflict (key_hash) do update set
    failures = case
      when throttle.window_started_at <= p_now - make_interval(secs => p_window_seconds) then 1
      else least(throttle.failures + 1, 1000)
    end,
    window_started_at = case
      when throttle.window_started_at <= p_now - make_interval(secs => p_window_seconds) then p_now
      else throttle.window_started_at
    end,
    blocked_until = case
      when (
        case
          when throttle.window_started_at <= p_now - make_interval(secs => p_window_seconds) then 1
          else throttle.failures + 1
        end
      ) >= p_max_failures then p_now + make_interval(secs => p_lockout_seconds)
      else throttle.blocked_until
    end,
    updated_at = p_now
  returning *;
end;
$$;

create or replace function public.luenio_accept_invitation(
  p_token_hash text,
  p_user_id text,
  p_password_hash text,
  p_membership_id text,
  p_now timestamptz
)
returns table (
  accepted_user_id text,
  accepted_email text,
  accepted_business_name text,
  accepted_plan text,
  accepted_role text,
  accepted_business_id text,
  accepted_created_at timestamptz,
  accepted_invitation_id text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  invitation_record public.invitations%rowtype;
begin
  if p_token_hash is null or length(p_token_hash) <> 64 or
     p_user_id is null or length(p_user_id) > 180 or
     p_membership_id is null or length(p_membership_id) > 180 or
     p_password_hash not like 'pbkdf2-sha256$%' then
    raise exception 'INVITATION_INVALID';
  end if;

  select * into invitation_record
  from public.invitations
  where token_hash = p_token_hash
  for update;

  if not found then
    raise exception 'INVITATION_INVALID';
  end if;
  if invitation_record.status <> 'pending' then
    raise exception 'INVITATION_UNAVAILABLE';
  end if;
  if invitation_record.expires_at <= p_now then
    raise exception 'INVITATION_EXPIRED';
  end if;
  if exists (select 1 from public.users where email = invitation_record.email) then
    raise exception 'INVITATION_USER_EXISTS';
  end if;

  insert into public.users (
    id,
    email,
    business_name,
    plan,
    password_hash,
    role,
    business_id,
    created_at,
    updated_at
  ) values (
    p_user_id,
    invitation_record.email,
    invitation_record.business_name,
    'starter',
    p_password_hash,
    invitation_record.role,
    invitation_record.business_id,
    p_now,
    p_now
  );

  insert into public.memberships (id, business_id, user_id, role, created_at)
  values (p_membership_id, invitation_record.business_id, p_user_id, invitation_record.role, p_now);

  update public.invitations
  set status = 'accepted', accepted_at = p_now
  where id = invitation_record.id;

  return query select
    p_user_id,
    invitation_record.email,
    invitation_record.business_name,
    'starter'::text,
    invitation_record.role,
    invitation_record.business_id,
    p_now,
    invitation_record.id;
end;
$$;

create or replace function public.luenio_consume_password_reset(
  p_token_hash text,
  p_password_hash text,
  p_now timestamptz
)
returns table (updated_user_id text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  reset_record public.password_resets%rowtype;
begin
  if p_token_hash is null or length(p_token_hash) <> 64 or
     p_password_hash not like 'pbkdf2-sha256$%' then
    raise exception 'RESET_INVALID';
  end if;

  select * into reset_record
  from public.password_resets
  where token_hash = p_token_hash
  for update;

  if not found then
    raise exception 'RESET_INVALID';
  end if;
  if reset_record.status <> 'pending' then
    raise exception 'RESET_UNAVAILABLE';
  end if;
  if reset_record.expires_at <= p_now then
    raise exception 'RESET_EXPIRED';
  end if;

  update public.users
  set password_hash = p_password_hash, updated_at = p_now
  where id = reset_record.user_id;

  update public.sessions
  set revoked_at = p_now
  where user_id = reset_record.user_id and revoked_at is null;

  update public.password_resets
  set status = 'used', used_at = p_now
  where id = reset_record.id;

  return query select reset_record.user_id;
end;
$$;

-- La firma gana un p_email. Sin soltar además la versión anterior, una base ya
-- desplegada conservaría las dos sobrecargas y la llamada quedaría ambigua.
drop function if exists public.luenio_store_contact_inquiry(text, text, text, text, text, text, text, text, timestamptz, integer);
drop function if exists public.luenio_store_contact_inquiry(text, text, text, text, text, text, text, text, text, timestamptz, integer);
drop function if exists public.luenio_store_contact_inquiry(text, text, text, text, text, text, text, text, text, text, timestamptz, integer);

create or replace function public.luenio_store_contact_inquiry(
  p_id text,
  p_delivery_id text,
  p_name text,
  p_business text,
  p_phone text,
  p_phone_normalized text,
  p_email text,
  p_service text,
  p_message text,
  p_source text,
  p_created_at timestamptz,
  p_duplicate_window_seconds integer
)
returns setof public.contact_inquiries
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_id is null or length(p_id) > 180 or
     p_delivery_id is null or length(p_delivery_id) > 180 or
     p_phone_normalized is null or length(p_phone_normalized) not between 8 and 20 or
     p_duplicate_window_seconds not between 30 and 600 then
    raise exception 'CONTACT_INVALID';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_phone_normalized, 0));
  if exists (
    select 1 from public.contact_inquiries
    where phone_normalized = p_phone_normalized
      and created_at >= p_created_at - make_interval(secs => p_duplicate_window_seconds)
  ) then
    raise exception 'CONTACT_DUPLICATE';
  end if;

  insert into public.contact_inquiries (
    id, name, business, phone, phone_normalized, email, service, message, source, created_at
  ) values (
    p_id, p_name, p_business, p_phone, p_phone_normalized, nullif(p_email, ''), p_service,
    p_message, p_source, p_created_at
  );

  insert into public.contact_deliveries (
    id, inquiry_id, status, attempts, next_attempt_at, created_at, updated_at
  ) values (
    p_delivery_id, p_id, 'pending', 0, p_created_at, p_created_at, p_created_at
  );

  return query
  select * from public.contact_inquiries where id = p_id;
end;
$$;

-- El tipo de retorno gana inquiry_email, y `create or replace` no puede cambiar
-- el retorno de una función existente: hay que soltarla primero.
drop function if exists public.luenio_claim_contact_deliveries(timestamptz, integer, integer, text);

create or replace function public.luenio_claim_contact_deliveries(
  p_now timestamptz,
  p_limit integer,
  p_lock_seconds integer,
  p_inquiry_id text default null
)
returns table (
  delivery_id text,
  inquiry_id text,
  inquiry_name text,
  inquiry_business text,
  inquiry_phone text,
  inquiry_email text,
  inquiry_service text,
  inquiry_message text,
  inquiry_source text,
  inquiry_created_at timestamptz,
  delivery_attempts integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_limit not between 1 and 50 or p_lock_seconds not between 30 and 600 then
    raise exception 'CONTACT_DELIVERY_INVALID';
  end if;

  return query
  with candidates as (
    select delivery.id
    from public.contact_deliveries as delivery
    where delivery.attempts < 10
      and (p_inquiry_id is null or delivery.inquiry_id = p_inquiry_id)
      and (
        (delivery.status in ('pending', 'retry') and delivery.next_attempt_at <= p_now)
        or (delivery.status = 'processing' and delivery.locked_until <= p_now)
      )
    order by delivery.next_attempt_at, delivery.created_at
    for update skip locked
    limit p_limit
  ), claimed as (
    update public.contact_deliveries as delivery
    set status = 'processing',
        attempts = delivery.attempts + 1,
        locked_until = p_now + make_interval(secs => p_lock_seconds),
        updated_at = p_now
    from candidates
    where delivery.id = candidates.id
    returning delivery.*
  )
  select
    claimed.id,
    inquiry.id,
    inquiry.name,
    inquiry.business,
    inquiry.phone,
    inquiry.email,
    inquiry.service,
    inquiry.message,
    inquiry.source,
    inquiry.created_at,
    claimed.attempts
  from claimed
  join public.contact_inquiries as inquiry on inquiry.id = claimed.inquiry_id;
end;
$$;

create or replace function public.luenio_complete_contact_delivery(
  p_delivery_id text,
  p_succeeded boolean,
  p_http_status integer,
  p_now timestamptz
)
returns table (delivery_status text, delivery_attempts integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_delivery_id is null or length(p_delivery_id) > 180 or
     (p_http_status is not null and p_http_status not between 100 and 599) then
    raise exception 'CONTACT_DELIVERY_INVALID';
  end if;

  return query
  update public.contact_deliveries as delivery
  set status = case
        when p_succeeded then 'sent'
        when delivery.attempts >= 10 then 'dead'
        else 'retry'
      end,
      next_attempt_at = case
        when p_succeeded then delivery.next_attempt_at
        else p_now + make_interval(secs => least(3600, (30 * power(2, greatest(delivery.attempts - 1, 0)))::integer))
      end,
      locked_until = null,
      delivered_at = case when p_succeeded then p_now else delivery.delivered_at end,
      last_http_status = p_http_status,
      updated_at = p_now
  where delivery.id = p_delivery_id and delivery.status = 'processing'
  returning delivery.status, delivery.attempts;
end;
$$;

-- Replaces the 4 sequential HTTP calls storeCrmRecord used to make (leads,
-- lead_actions, lead_notifications, events) with one transactional write
-- that also creates the queued automation_deliveries rows. p_lead/p_action/
-- p_notification use the same snake_case shape as the existing
-- map*ForSupabase() helpers in db/storage.js; p_events/p_deliveries are
-- JSONB arrays (variable length, can't be scalar params). Dedupe-by-phone
-- and plan-limit checks stay in JS, exactly as before this change.
create or replace function public.luenio_store_crm_record(
  p_lead jsonb,
  p_action jsonb,
  p_notification jsonb,
  p_events jsonb,
  p_deliveries jsonb
)
returns setof public.leads
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  event_row jsonb;
  delivery_row jsonb;
begin
  if p_lead->>'id' is null or length(p_lead->>'id') > 180 or
     p_action->>'id' is null or length(p_action->>'id') > 180 or
     p_notification->>'id' is null or length(p_notification->>'id') > 180 or
     p_lead->>'business_id' is null then
    raise exception 'CRM_RECORD_INVALID';
  end if;

  insert into public.leads (
    id, user_id, business_id, name, business, phone, phone_normalized, service, message,
    source, notes, tags, next_action, next_action_at, last_contacted_at, contact_log,
    assignee_user_id, score, classification, status, pipeline_stage, score_reasons,
    workflow, created_at, updated_at
  ) values (
    p_lead->>'id', p_lead->>'user_id', p_lead->>'business_id', p_lead->>'name',
    p_lead->>'business', p_lead->>'phone', p_lead->>'phone_normalized', p_lead->>'service',
    p_lead->>'message', p_lead->>'source', coalesce(p_lead->>'notes', ''),
    coalesce(p_lead->'tags', '[]'::jsonb), coalesce(p_lead->>'next_action', ''),
    nullif(p_lead->>'next_action_at', '')::timestamptz, nullif(p_lead->>'last_contacted_at', '')::timestamptz,
    coalesce(p_lead->'contact_log', '[]'::jsonb), nullif(p_lead->>'assignee_user_id', ''),
    coalesce((p_lead->>'score')::integer, 0), p_lead->>'classification', p_lead->>'status',
    p_lead->>'pipeline_stage', coalesce(p_lead->'score_reasons', '[]'::jsonb), p_lead->>'workflow',
    coalesce(nullif(p_lead->>'created_at', '')::timestamptz, now()),
    coalesce(nullif(p_lead->>'updated_at', '')::timestamptz, now())
  );

  insert into public.lead_actions (
    id, user_id, business_id, lead_id, workflow, segment, actions, score, classification,
    pipeline_stage, score_reasons, restricted_actions, integration_results,
    internal_action_results, created_at
  ) values (
    p_action->>'id', p_action->>'user_id', p_action->>'business_id', p_action->>'lead_id',
    p_action->>'workflow', p_action->>'segment', coalesce(p_action->'actions', '[]'::jsonb),
    (p_action->>'score')::integer, p_action->>'classification', p_action->>'pipeline_stage',
    coalesce(p_action->'score_reasons', '[]'::jsonb), coalesce(p_action->'restricted_actions', '[]'::jsonb),
    coalesce(p_action->'integration_results', '[]'::jsonb), coalesce(p_action->'internal_action_results', '[]'::jsonb),
    coalesce(nullif(p_action->>'created_at', '')::timestamptz, now())
  );

  insert into public.lead_notifications (
    id, user_id, business_id, lead_id, workflow, classification, summary, created_at
  ) values (
    p_notification->>'id', p_notification->>'user_id', p_notification->>'business_id',
    p_notification->>'lead_id', p_notification->>'workflow', p_notification->>'classification',
    p_notification->>'summary', coalesce(nullif(p_notification->>'created_at', '')::timestamptz, now())
  );

  for event_row in select * from jsonb_array_elements(coalesce(p_events, '[]'::jsonb))
  loop
    insert into public.events (id, user_id, business_id, lead_id, type, payload, created_at)
    values (
      event_row->>'id', event_row->>'user_id', event_row->>'business_id', event_row->>'lead_id',
      event_row->>'type', coalesce(event_row->'payload', '{}'::jsonb),
      coalesce(nullif(event_row->>'created_at', '')::timestamptz, now())
    );
  end loop;

  for delivery_row in select * from jsonb_array_elements(coalesce(p_deliveries, '[]'::jsonb))
  loop
    insert into public.automation_deliveries (
      id, lead_id, business_id, action, payload, status, attempts, next_attempt_at, created_at, updated_at
    ) values (
      delivery_row->>'id', delivery_row->>'lead_id', delivery_row->>'business_id',
      delivery_row->>'action', coalesce(delivery_row->'payload', '{}'::jsonb),
      coalesce(delivery_row->>'status', 'pending'), coalesce((delivery_row->>'attempts')::integer, 0),
      coalesce(nullif(delivery_row->>'next_attempt_at', '')::timestamptz, now()),
      coalesce(nullif(delivery_row->>'created_at', '')::timestamptz, now()),
      coalesce(nullif(delivery_row->>'updated_at', '')::timestamptz, now())
    );
  end loop;

  return query
  select * from public.leads where id = p_lead->>'id';
end;
$$;

create or replace function public.luenio_claim_automation_deliveries(
  p_now timestamptz,
  p_limit integer,
  p_lock_seconds integer,
  p_lead_id text default null
)
returns table (
  delivery_id text,
  lead_id text,
  action text,
  payload jsonb,
  delivery_attempts integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_limit not between 1 and 50 or p_lock_seconds not between 30 and 600 then
    raise exception 'AUTOMATION_DELIVERY_INVALID';
  end if;

  return query
  with candidates as (
    select delivery.id
    from public.automation_deliveries as delivery
    where delivery.attempts < 10
      and (p_lead_id is null or delivery.lead_id = p_lead_id)
      and (
        (delivery.status in ('pending', 'retry') and delivery.next_attempt_at <= p_now)
        or (delivery.status = 'processing' and delivery.locked_until <= p_now)
      )
    order by delivery.next_attempt_at, delivery.created_at
    for update skip locked
    limit p_limit
  ), claimed as (
    update public.automation_deliveries as delivery
    set status = 'processing',
        attempts = delivery.attempts + 1,
        locked_until = p_now + make_interval(secs => p_lock_seconds),
        updated_at = p_now
    from candidates
    where delivery.id = candidates.id
    returning delivery.*
  )
  select claimed.id, claimed.lead_id, claimed.action, claimed.payload, claimed.attempts
  from claimed;
end;
$$;

create or replace function public.luenio_complete_automation_delivery(
  p_delivery_id text,
  p_succeeded boolean,
  p_http_status integer,
  p_now timestamptz
)
returns table (delivery_status text, delivery_attempts integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_delivery_id is null or length(p_delivery_id) > 180 or
     (p_http_status is not null and p_http_status not between 100 and 599) then
    raise exception 'AUTOMATION_DELIVERY_INVALID';
  end if;

  return query
  update public.automation_deliveries as delivery
  set status = case
        when p_succeeded then 'sent'
        when delivery.attempts >= 10 then 'dead'
        else 'retry'
      end,
      next_attempt_at = case
        when p_succeeded then delivery.next_attempt_at
        else p_now + make_interval(secs => least(3600, (30 * power(2, greatest(delivery.attempts - 1, 0)))::integer))
      end,
      locked_until = null,
      delivered_at = case when p_succeeded then p_now else delivery.delivered_at end,
      last_http_status = p_http_status,
      updated_at = p_now
  where delivery.id = p_delivery_id and delivery.status = 'processing'
  returning delivery.status, delivery.attempts;
end;
$$;

create or replace function public.luenio_consume_mfa_challenge(
  p_challenge_id text,
  p_code_hash text,
  p_now timestamptz,
  p_max_attempts integer
)
returns table (verification_result text, verified_user_id text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  challenge_record public.auth_challenges%rowtype;
  next_attempts integer;
begin
  if p_challenge_id is null or length(p_challenge_id) > 180 or
     p_code_hash is null or length(p_code_hash) <> 64 or
     p_max_attempts not between 3 and 10 then
    return query select 'invalid'::text, null::text;
    return;
  end if;

  select * into challenge_record
  from public.auth_challenges
  where id = p_challenge_id
  for update;

  if not found or challenge_record.status <> 'pending' then
    return query select 'invalid'::text, null::text;
    return;
  end if;
  if challenge_record.expires_at <= p_now then
    update public.auth_challenges set status = 'expired' where id = challenge_record.id;
    return query select 'invalid'::text, null::text;
    return;
  end if;

  next_attempts := challenge_record.attempts + 1;
  if challenge_record.code_hash = p_code_hash then
    update public.auth_challenges
    set status = 'verified', attempts = next_attempts, verified_at = p_now
    where id = challenge_record.id;
    return query select 'verified'::text, challenge_record.user_id;
    return;
  end if;

  update public.auth_challenges
  set attempts = next_attempts,
      status = case when next_attempts >= p_max_attempts then 'locked' else 'pending' end
  where id = challenge_record.id;
  return query select
    case when next_attempts >= p_max_attempts then 'locked'::text else 'invalid'::text end,
    null::text;
end;
$$;

create or replace function public.luenio_security_maintenance()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  maintenance_now timestamptz := clock_timestamp();
  cleaned_sessions integer := 0;
  cleaned_resets integer := 0;
  cleaned_challenges integer := 0;
  cleaned_throttles integer := 0;
  cleaned_invitations integer := 0;
  cleaned_audits integer := 0;
  cleaned_deliveries integer := 0;
  cleaned_inquiries integer := 0;
  cleaned_automation_deliveries integer := 0;
begin
  update public.invitations
  set status = 'expired'
  where status = 'pending' and expires_at <= maintenance_now;

  delete from public.sessions
  where expires_at < maintenance_now - interval '7 days'
     or revoked_at < maintenance_now - interval '7 days';
  get diagnostics cleaned_sessions = row_count;

  delete from public.password_resets
  where created_at < maintenance_now - interval '7 days';
  get diagnostics cleaned_resets = row_count;

  delete from public.auth_challenges
  where created_at < maintenance_now - interval '7 days';
  get diagnostics cleaned_challenges = row_count;

  delete from public.auth_throttles
  where updated_at < maintenance_now - interval '2 days'
    and (blocked_until is null or blocked_until < maintenance_now);
  get diagnostics cleaned_throttles = row_count;

  delete from public.invitations
  where status in ('accepted', 'revoked', 'expired')
    and created_at < maintenance_now - interval '30 days';
  get diagnostics cleaned_invitations = row_count;

  delete from public.audit_logs
  where created_at < maintenance_now - interval '365 days';
  get diagnostics cleaned_audits = row_count;

  update public.contact_deliveries
  set status = 'dead', locked_until = null, updated_at = maintenance_now
  where status = 'processing' and attempts >= 10 and locked_until < maintenance_now;

  delete from public.contact_deliveries
  where status in ('sent', 'dead')
    and updated_at < maintenance_now - interval '30 days';
  get diagnostics cleaned_deliveries = row_count;

  delete from public.contact_inquiries
  where created_at < maintenance_now - interval '730 days';
  get diagnostics cleaned_inquiries = row_count;

  update public.automation_deliveries
  set status = 'dead', locked_until = null, updated_at = maintenance_now
  where status = 'processing' and attempts >= 10 and locked_until < maintenance_now;

  delete from public.automation_deliveries
  where status in ('sent', 'dead')
    and updated_at < maintenance_now - interval '30 days';
  get diagnostics cleaned_automation_deliveries = row_count;

  return jsonb_build_object(
    'sessions', cleaned_sessions,
    'passwordResets', cleaned_resets,
    'authChallenges', cleaned_challenges,
    'authThrottles', cleaned_throttles,
    'invitations', cleaned_invitations,
    'auditLogs', cleaned_audits,
    'contactDeliveries', cleaned_deliveries,
    'contactInquiries', cleaned_inquiries,
    'automationDeliveries', cleaned_automation_deliveries,
    'completedAt', maintenance_now
  );
end;
$$;

do $$
declare
  protected_table text;
begin
  foreach protected_table in array array[
    'users',
    'businesses',
    'memberships',
    'invitations',
    'audit_logs',
    'password_resets',
    'sessions',
    'auth_throttles',
    'auth_challenges',
    'pipeline_stages',
    'leads',
    'events',
    'lead_actions',
    'lead_notifications',
    'subscriptions',
    'contact_inquiries',
    'contact_deliveries',
    'automation_deliveries'
  ]
  loop
    execute format('alter table public.%I enable row level security', protected_table);
    execute format('alter table public.%I force row level security', protected_table);
    execute format('revoke all on table public.%I from anon, authenticated', protected_table);
    execute format('grant all on table public.%I to service_role', protected_table);
  end loop;
end
$$;

revoke all on schema public from anon, authenticated;
grant usage on schema public to service_role;

revoke all on function public.luenio_register_auth_failure(text, timestamptz, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.luenio_accept_invitation(text, text, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.luenio_consume_password_reset(text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.luenio_store_contact_inquiry(text, text, text, text, text, text, text, text, text, text, timestamptz, integer) from public, anon, authenticated;
revoke all on function public.luenio_claim_contact_deliveries(timestamptz, integer, integer, text) from public, anon, authenticated;
revoke all on function public.luenio_complete_contact_delivery(text, boolean, integer, timestamptz) from public, anon, authenticated;
revoke all on function public.luenio_consume_mfa_challenge(text, text, timestamptz, integer) from public, anon, authenticated;
revoke all on function public.luenio_security_maintenance() from public, anon, authenticated;
revoke all on function public.luenio_store_crm_record(jsonb, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.luenio_claim_automation_deliveries(timestamptz, integer, integer, text) from public, anon, authenticated;
revoke all on function public.luenio_complete_automation_delivery(text, boolean, integer, timestamptz) from public, anon, authenticated;
grant execute on function public.luenio_register_auth_failure(text, timestamptz, integer, integer, integer) to service_role;
grant execute on function public.luenio_accept_invitation(text, text, text, text, timestamptz) to service_role;
grant execute on function public.luenio_consume_password_reset(text, text, timestamptz) to service_role;
grant execute on function public.luenio_store_contact_inquiry(text, text, text, text, text, text, text, text, text, text, timestamptz, integer) to service_role;
grant execute on function public.luenio_claim_contact_deliveries(timestamptz, integer, integer, text) to service_role;
grant execute on function public.luenio_complete_contact_delivery(text, boolean, integer, timestamptz) to service_role;
grant execute on function public.luenio_consume_mfa_challenge(text, text, timestamptz, integer) to service_role;
grant execute on function public.luenio_security_maintenance() to service_role;
grant execute on function public.luenio_store_crm_record(jsonb, jsonb, jsonb, jsonb, jsonb) to service_role;
grant execute on function public.luenio_claim_automation_deliveries(timestamptz, integer, integer, text) to service_role;
grant execute on function public.luenio_complete_automation_delivery(text, boolean, integer, timestamptz) to service_role;

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
