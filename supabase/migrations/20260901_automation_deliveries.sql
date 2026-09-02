-- Persist-then-deliver queue for internal CRM automation (send_webhook,
-- send_crm_webhook, send_whatsapp_notification, send_email_notification).
-- Mirrors contact_deliveries/luenio_*_contact_delivery exactly, fanned out
-- to up to 4 rows per lead (one per configured integration target) instead
-- of 1 row per contact inquiry.

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

do $$
begin
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

create index if not exists automation_deliveries_due_idx on public.automation_deliveries(status, next_attempt_at);
create index if not exists automation_deliveries_locked_idx on public.automation_deliveries(locked_until) where status = 'processing';
create index if not exists automation_deliveries_lead_idx on public.automation_deliveries(lead_id);

-- Replaces the 4 sequential HTTP calls storeCrmRecord used to make (leads,
-- lead_actions, lead_notifications, events) with one transactional write
-- that also creates the queued delivery rows. p_lead/p_action/p_notification
-- use the same snake_case shape as the existing map*ForSupabase() helpers in
-- db/storage.js; p_events/p_deliveries are JSONB arrays (variable length,
-- can't be scalar params). Dedupe-by-phone and plan-limit checks stay in JS,
-- exactly as before -- out of scope for this change.
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

do $$
begin
  execute 'alter table public.automation_deliveries enable row level security';
  execute 'alter table public.automation_deliveries force row level security';
  execute 'revoke all on table public.automation_deliveries from anon, authenticated';
  execute 'grant all on table public.automation_deliveries to service_role';
end
$$;

revoke all on function public.luenio_store_crm_record(jsonb, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.luenio_claim_automation_deliveries(timestamptz, integer, integer, text) from public, anon, authenticated;
revoke all on function public.luenio_complete_automation_delivery(text, boolean, integer, timestamptz) from public, anon, authenticated;
grant execute on function public.luenio_store_crm_record(jsonb, jsonb, jsonb, jsonb, jsonb) to service_role;
grant execute on function public.luenio_claim_automation_deliveries(timestamptz, integer, integer, text) to service_role;
grant execute on function public.luenio_complete_automation_delivery(text, boolean, integer, timestamptz) to service_role;
