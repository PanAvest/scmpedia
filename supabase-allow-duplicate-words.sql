alter table public.words
add column if not exists source_key text;

update public.words
set source_key = lower(term)
where source_key is null;

alter table public.words
alter column source_key set not null;

alter table public.words
drop constraint if exists words_term_key;

create unique index if not exists words_source_key_idx
on public.words (source_key);

create index if not exists words_term_idx
on public.words using btree (lower(term));
