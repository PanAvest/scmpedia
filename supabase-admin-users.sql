-- Admin user management for SCMpedia (delete / bulk delete, premium grants).
-- Run this once in the Supabase SQL editor BEFORE using the Users tab.
-- Safe to re-run.

-- 1) Payment history that survives a user deletion.
--    scmpedia_payments was declared in supabase-schema.sql but never created in this
--    project, so Paystack's upsert (api/paystack/verify.ts, webhook.ts) has been
--    silently failing and no payments were recorded anywhere but Paystack's dashboard.
--    Create it now with user_id NULLABLE + ON DELETE SET NULL (not cascade), and a
--    user_email snapshot column, so deleting a user keeps the money trail joinable
--    for refunds, disputes and month-end reconciliation.
create table if not exists public.scmpedia_payments (
  reference  text primary key,
  user_id    uuid references auth.users(id) on delete set null,
  user_email text,
  plan       text not null,
  amount     integer not null,
  currency   text not null default 'GHS',
  status     text not null,
  raw        jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.scmpedia_payments enable row level security;
create index if not exists scmpedia_payments_user_id_idx on public.scmpedia_payments (user_id);

-- If the table already existed with the old cascade FK, migrate it in place (no-op
-- on a fresh create above).
alter table public.scmpedia_payments add column if not exists user_email text;
alter table public.scmpedia_payments alter column user_id drop not null;
alter table public.scmpedia_payments drop constraint if exists scmpedia_payments_user_id_fkey;
alter table public.scmpedia_payments
  add constraint scmpedia_payments_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;

-- 2) Archive of deleted accounts. api/_raffle.ts recomputes the draw commitment from
--    the LIVE auth.users list, so a deleted winner would make a published, provably-fair
--    draw impossible to re-verify. Keeping the snapshot means the pool can still be
--    reconstructed, and support can answer "who was this user?" after the fact.
create table if not exists public.scmpedia_deleted_users (
  id uuid primary key,               -- the old auth.users id
  email text,
  user_metadata jsonb,               -- student_university, student_index_number, ...
  app_metadata jsonb,                -- scmpedia_subscription at time of deletion
  payments jsonb,                    -- snapshot of scmpedia_payments rows
  raffle_winner boolean not null default false,
  deleted_by text,                   -- admin email
  deleted_at timestamptz not null default now()
);
alter table public.scmpedia_deleted_users enable row level security;
-- No public policies on purpose: server-only (SUPABASE_SERVICE_ROLE_KEY).

-- 3) Audit trail for destructive / privilege-changing admin actions.
create table if not exists public.scmpedia_admin_audit (
  id uuid primary key default gen_random_uuid(),
  actor_email text not null,
  actor_role text not null,
  action text not null,              -- 'user.delete' | 'user.premium.grant' | 'user.premium.remove'
  target_id text,
  target_email text,
  details jsonb,
  created_at timestamptz not null default now()
);
alter table public.scmpedia_admin_audit enable row level security;
-- No public policies on purpose: server-only.

create index if not exists scmpedia_admin_audit_created_idx
  on public.scmpedia_admin_audit (created_at desc);
create index if not exists scmpedia_deleted_users_deleted_at_idx
  on public.scmpedia_deleted_users (deleted_at desc);

-- 4) Admin-approved additions to the university picker.
--    The curated list in src/data/universities.ts stays the SEED (renders instantly,
--    works offline, reviewable in git). This table holds only what an admin promotes
--    into the official list. The client merges seed + these rows at runtime, exactly
--    like scmpedia_plans (static defaults + DB overrides).
create extension if not exists "pgcrypto";
create table if not exists public.scmpedia_universities (
  id           uuid primary key default gen_random_uuid(),
  country_code text not null,                          -- a code from UNIVERSITY_COUNTRIES
  name         text not null,                          -- canonical display name in the picker
  name_key     text not null,                          -- normalized dedupe key
  created_by   text,                                   -- admin email that added it
  created_at   timestamptz not null default now()
);
-- One school per country (by normalized key).
create unique index if not exists scmpedia_universities_country_key
  on public.scmpedia_universities (country_code, name_key);
alter table public.scmpedia_universities enable row level security;
-- RLS on with NO policies: service role only. Public reads go through GET /api/universities.

-- 4b) Only PUBLISHED raffle draws protect their winners from deletion. Historical/test
--     draws default to false, so they stop over-blocking user deletion.
alter table public.scmpedia_raffle_draws add column if not exists published boolean not null default false;

-- 5) Premium grant/revoke audit (best-effort; the endpoint tolerates its absence).
create table if not exists public.scmpedia_admin_grants (
  id         uuid primary key default gen_random_uuid(),
  actor      text not null,           -- admin email
  action     text not null,           -- 'grant' | 'revoke'
  user_id    uuid not null,
  email      text not null default '',
  detail     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.scmpedia_admin_grants enable row level security;
create index if not exists scmpedia_admin_grants_user_idx
  on public.scmpedia_admin_grants (user_id, created_at desc);
