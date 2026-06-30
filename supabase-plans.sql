-- Editable subscription pricing for SCMpedia.
-- Run this once in the Supabase SQL editor to let the admin panel change prices.
-- Safe to re-run: existing rows / edited prices are preserved.

create table if not exists public.scmpedia_plans (
  id text primary key,
  tier text not null,
  period text not null,
  amount integer not null,          -- price in pesewas (Ghana Cedis * 100)
  duration_days integer not null,
  label text not null,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.scmpedia_plans enable row level security;
-- No public policies on purpose: this table is read and written only through the
-- server (SUPABASE_SERVICE_ROLE_KEY), never from the browser.

insert into public.scmpedia_plans (id, tier, period, amount, duration_days, label) values
  ('student-monthly', 'student', 'monthly', 500,   31,  'SCMPEDIA Student · Monthly'),
  ('student-annual',  'student', 'annual',  5000,  366, 'SCMPEDIA Student · Annual'),
  ('pro-monthly',     'pro',     'monthly', 1200,  31,  'SCMPEDIA Professional · Monthly'),
  ('pro-annual',      'pro',     'annual',  12000, 366, 'SCMPEDIA Professional · Annual')
on conflict (id) do nothing;
