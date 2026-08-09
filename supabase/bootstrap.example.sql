-- Example only. Do NOT commit real passwords or service keys.
-- Replace IDs and hashes. Password hashing must match the app:
-- PBKDF2-HMAC-SHA256, 600_000 iterations (see api/services/auth-service.js).
-- Prefer generating the hash with a one-off Node script that imports the app hasher.

-- 1) Business
insert into public.businesses (id, name, created_at, updated_at)
values (
  'biz_example_main',
  'Luenio Ops',
  now(),
  now()
)
on conflict (id) do nothing;

-- 2) Admin user (password_hash MUST be a real app-compatible hash)
insert into public.users (
  id,
  email,
  business_name,
  plan,
  password_hash,
  role,
  business_id,
  subscription_status,
  created_at,
  updated_at
)
values (
  'usr_example_admin',
  'admin@example.com',
  'Luenio Ops',
  'agency',
  'REPLACE_WITH_PBKDF2_HASH',
  'admin',
  'biz_example_main',
  'active',
  now(),
  now()
)
on conflict (id) do nothing;

-- 3) Membership
insert into public.memberships (id, business_id, user_id, role, created_at)
values (
  'mem_example_admin',
  'biz_example_main',
  'usr_example_admin',
  'admin',
  now()
)
on conflict (id) do nothing;

-- Verify with anon key: must fail to select from public.users / public.leads.
