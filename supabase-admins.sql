-- Admin accounts & roles for SCMpedia.
-- Run this once in the Supabase SQL editor to enable multiple admins, roles,
-- and password changes from the admin dashboard.
-- Safe to re-run: existing rows are preserved.

create table if not exists public.scmpedia_admins (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,      -- scrypt$salt$hash (never plaintext)
  role text not null default 'admin', -- 'master' (manage accounts) | 'admin'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.scmpedia_admins enable row level security;
-- No public policies on purpose: read/written only through the server
-- (SUPABASE_SERVICE_ROLE_KEY), never from the browser.

create index if not exists scmpedia_admins_email_idx on public.scmpedia_admins (lower(email));
