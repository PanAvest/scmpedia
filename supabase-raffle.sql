-- Immutable audit trail for SCMpedia launch raffle draws.
-- Optional: the Grand Draw works without it, but running this once in the Supabase
-- SQL editor records every draw (commitment + seed + winners) so any result can be
-- re-verified later. Written only by the server (SUPABASE_SERVICE_ROLE_KEY).
-- Safe to re-run.

create table if not exists public.scmpedia_raffle_draws (
  id uuid primary key default gen_random_uuid(),
  seed text not null,
  cutoff timestamptz not null,
  university text not null default 'ALL',
  commitment text not null,          -- sha256 of the frozen, ordered entry list
  pool_size integer not null,
  draw_size integer not null,
  winners jsonb not null,            -- [{ rank, name, university, index_number, ... }]
  drawn_by text,
  created_at timestamptz not null default now()
);

alter table public.scmpedia_raffle_draws enable row level security;
-- No public policies on purpose: this table is read/written only through the
-- server with the service role key, never from the browser.

create index if not exists scmpedia_raffle_draws_created_idx
  on public.scmpedia_raffle_draws (created_at desc);
