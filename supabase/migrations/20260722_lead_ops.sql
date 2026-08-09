-- Lead operational CRM fields (next action, contact log).
-- Safe to re-run: IF NOT EXISTS.

alter table public.leads add column if not exists notes text not null default '';
alter table public.leads add column if not exists tags jsonb not null default '[]'::jsonb;
alter table public.leads add column if not exists next_action text not null default '';
alter table public.leads add column if not exists next_action_at timestamptz;
alter table public.leads add column if not exists last_contacted_at timestamptz;
alter table public.leads add column if not exists contact_log jsonb not null default '[]'::jsonb;
