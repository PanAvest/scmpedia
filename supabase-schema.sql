create extension if not exists "pgcrypto";

create table if not exists public.words (
  id uuid primary key default gen_random_uuid(),
  term text not null unique,
  definition text not null,
  synonyms text,
  tags text,
  pronunciation text,
  pos text,
  examples text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  first_name text,
  last_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  word_id uuid references public.words(id) on delete cascade,
  term text not null,
  created_at timestamptz not null default now(),
  unique (user_id, term)
);

alter table public.words enable row level security;
alter table public.profiles enable row level security;
alter table public.favorites enable row level security;

drop policy if exists "Words are readable by everyone" on public.words;
drop policy if exists "Authenticated users can read words" on public.words;

-- No public SELECT policy for words.
-- The app should search words through /api/words with SUPABASE_SERVICE_ROLE_KEY.
-- This prevents the browser publishable key from dumping the full words table.

drop policy if exists "Users can read their profile" on public.profiles;
create policy "Users can read their profile"
on public.profiles for select
using (auth.uid() = id);

drop policy if exists "Users can update their profile" on public.profiles;
create policy "Users can update their profile"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "Users can read their favorites" on public.favorites;
create policy "Users can read their favorites"
on public.favorites for select
using (auth.uid() = user_id);

drop policy if exists "Users can add their favorites" on public.favorites;
create policy "Users can add their favorites"
on public.favorites for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their favorites" on public.favorites;
create policy "Users can delete their favorites"
on public.favorites for delete
using (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, first_name, last_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create index if not exists words_term_idx on public.words using btree (lower(term));
create index if not exists favorites_user_id_idx on public.favorites (user_id);
