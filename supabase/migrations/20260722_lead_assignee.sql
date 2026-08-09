-- Assign leads to workspace members.
alter table public.leads add column if not exists assignee_user_id text references public.users(id) on delete set null;
