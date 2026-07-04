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
  score integer not null default 0,
  classification text not null default 'cold',
  status text not null default 'new',
  pipeline_stage text not null default 'new',
  score_reasons jsonb not null default '[]'::jsonb,
  workflow text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
  service text not null,
  message text,
  source text,
  created_at timestamptz not null default now()
);

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

create index if not exists users_email_idx on public.users(email);
create index if not exists pipeline_stages_user_position_idx on public.pipeline_stages(user_id, position);
create index if not exists leads_user_created_at_idx on public.leads(user_id, created_at desc);
create index if not exists leads_user_phone_created_at_idx on public.leads(user_id, phone_normalized, created_at desc);
create index if not exists leads_user_score_idx on public.leads(user_id, score);
create index if not exists leads_user_pipeline_stage_idx on public.leads(user_id, pipeline_stage);
create index if not exists events_user_created_at_idx on public.events(user_id, created_at desc);
create index if not exists lead_actions_user_created_at_idx on public.lead_actions(user_id, created_at desc);
create index if not exists lead_notifications_user_created_at_idx on public.lead_notifications(user_id, created_at desc);
create index if not exists subscriptions_user_idx on public.subscriptions(user_id);
create index if not exists contact_inquiries_created_at_idx on public.contact_inquiries(created_at desc);
create index if not exists contact_inquiries_phone_created_at_idx on public.contact_inquiries(phone_normalized, created_at desc);
