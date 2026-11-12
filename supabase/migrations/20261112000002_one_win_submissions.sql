-- Migration 20261112000002: Game #1 (`1 Win`) real-time community gratitude submissions
-- Idempotent. Enforces RLS, least-privilege grants, 1-submission-per-day constraints,
-- SQL-layer length/word/moderation guardrails, Realtime publication, and Top 100 RPC.

create table if not exists public.one_win_submissions (
  id uuid primary key default gen_random_uuid(),
  puzzle_date date not null,
  user_id uuid references auth.users(id) on delete set null,
  client_fingerprint text not null
    constraint one_win_fingerprint_length_check
    check (char_length(btrim(client_fingerprint)) between 8 and 128),
  raw_text text not null
    constraint one_win_raw_text_length_check
    check (char_length(btrim(raw_text)) between 1 and 35),
  normalized_key text not null
    constraint one_win_normalized_key_length_check
    check (char_length(btrim(normalized_key)) between 1 and 35),
  display_text text not null
    constraint one_win_display_text_length_check
    check (char_length(btrim(display_text)) between 1 and 35),
  created_at timestamptz not null default now(),
  constraint one_win_unique_date_fingerprint unique (puzzle_date, client_fingerprint)
);

create index if not exists idx_one_win_submissions_date_key
  on public.one_win_submissions (puzzle_date, normalized_key);

create unique index if not exists idx_one_win_submissions_unique_user_date
  on public.one_win_submissions (puzzle_date, user_id)
  where user_id is not null;

-- SQL-layer length, word-count (1..4 words), and Tier 1 + Tier 2 public moderation guard
create or replace function public.enforce_one_win_submission_moderation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cleaned text;
  words text[];
  word_count integer;
begin
  new.client_fingerprint := btrim(new.client_fingerprint);
  new.raw_text := btrim(new.raw_text);
  new.normalized_key := lower(btrim(new.normalized_key));
  new.display_text := btrim(new.display_text);

  if char_length(new.raw_text) < 1 or char_length(new.raw_text) > 35 then
    raise exception '1 Win entry must be between 1 and 35 characters'
      using errcode = '22023';
  end if;

  words := regexp_split_to_array(regexp_replace(new.raw_text, '[^\w\s]+', ' ', 'g'), '\s+');
  select count(*) into word_count
  from unnest(words) as w
  where btrim(w) <> '';

  if word_count < 1 or word_count > 4 then
    raise exception '1 Win entry must be between 1 and 4 words'
      using errcode = '22023';
  end if;

  cleaned := lower(new.raw_text || ' ' || new.normalized_key);
  if cleaned ~* '\m(fuck|fucking|fucked|fucker|motherfucker|shit|shitty|bullshit|bitch|cunt|dick|dickhead|pussy|cock|asshole|arsehole|dumbass|jackass|bastard|slut|whore|piss|damn|goddamn|crap|nigger|nigga|faggot|fag|kike|chink|spic|gook|wetback|retard|retarded|tranny|dyke|1488)\M' then
    raise exception 'Submission blocked by public community moderation filter'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_one_win_submission_moderation on public.one_win_submissions;
create trigger trg_enforce_one_win_submission_moderation
  before insert or update on public.one_win_submissions
  for each row execute function public.enforce_one_win_submission_moderation();

alter table public.one_win_submissions enable row level security;

-- Reset default privileges explicitly: zero UPDATE allowed; GM-only DELETE.
revoke all on table public.one_win_submissions from anon, authenticated;
grant select on table public.one_win_submissions to anon, authenticated;
grant insert (
  puzzle_date, user_id, client_fingerprint, raw_text, normalized_key, display_text
) on table public.one_win_submissions to anon, authenticated;
grant delete on table public.one_win_submissions to authenticated;

drop policy if exists "one_win_submissions_select_public" on public.one_win_submissions;
drop policy if exists "one_win_submissions_insert_daily" on public.one_win_submissions;
drop policy if exists "one_win_submissions_delete_gm_only" on public.one_win_submissions;

create policy "one_win_submissions_select_public"
  on public.one_win_submissions
  for select
  to anon, authenticated
  using (true);

create policy "one_win_submissions_insert_daily"
  on public.one_win_submissions
  for insert
  to anon, authenticated
  with check (
    puzzle_date between (current_date - 1) and (current_date + 1)
    and char_length(btrim(raw_text)) between 1 and 35
    and char_length(btrim(normalized_key)) between 1 and 35
    and char_length(btrim(display_text)) between 1 and 35
    and (
      (auth.role() = 'anon' and user_id is null)
      or (
        auth.role() = 'authenticated'
        and (user_id is null or user_id = auth.uid())
        and not public.is_current_user_banned()
      )
    )
  );

create policy "one_win_submissions_delete_gm_only"
  on public.one_win_submissions
  for delete
  to authenticated
  using (public.is_root_game_master());

-- Top 100 daily community wins aggregation RPC
create or replace function public.get_one_win_top_100(target_date date)
returns table (
  rank bigint,
  normalized_key text,
  display_text text,
  submission_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with grouped as (
    select
      s.normalized_key,
      min(s.display_text) as display_text,
      count(*)::bigint as submission_count,
      min(s.created_at) as first_seen
    from public.one_win_submissions s
    where s.puzzle_date = target_date
    group by s.normalized_key
  )
  select
    row_number() over (
      order by g.submission_count desc, g.first_seen asc, g.normalized_key asc
    ) as rank,
    g.normalized_key,
    g.display_text,
    g.submission_count
  from grouped g
  order by rank asc
  limit 100;
$$;

grant execute on function public.get_one_win_top_100(date) to anon, authenticated;

-- Enable Realtime on one_win_submissions so rankings update live on screen
do $$
begin
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'one_win_submissions') then
    alter table public.one_win_submissions replica identity full;
  end if;

  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'one_win_submissions'
    ) then
      alter publication supabase_realtime add table public.one_win_submissions;
    end if;
  end if;
end;
$$;
