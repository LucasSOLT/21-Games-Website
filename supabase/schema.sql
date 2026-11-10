-- =============================================================================
-- SOL GaMES (21games.ai) — Supabase Postgres Schema
-- Architecture: Vercel (Static/Edge Frontend) + Supabase Postgres
-- Zero Firebase/Firestore dependencies.
-- Updated for Milestone M2.5-B2 (P0 Auth & Login Security Lockdown)
-- =============================================================================

create extension if not exists "pgcrypto";

-- 1. Daily & Admin Puzzles Table (All 9 SOL GaMES Countdown Titles)
create table if not exists public.daily_puzzles (
  id uuid primary key default gen_random_uuid(),
  game_slug text not null check (game_slug in ('21-things', '17-syllables', '9-rhymes', 'eightfold-echo', '6-pics', 'connect-5', 'four-score', 'move-2', '1-win')),
  puzzle_date date not null,
  puzzle_number integer not null,
  title text not null,
  author text not null default 'SOL Theory',
  editor text not null default 'Daily Editorial',
  content_hash text,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (game_slug, puzzle_date)
);

alter table public.daily_puzzles add column if not exists content_hash text;
alter table public.daily_puzzles drop constraint if exists daily_puzzles_game_slug_check;
alter table public.daily_puzzles add constraint daily_puzzles_game_slug_check
  check (game_slug in ('21-things', '17-syllables', '9-rhymes', 'eightfold-echo', '6-pics', 'connect-5', 'four-score', 'move-2', '1-win'));

create index if not exists idx_daily_puzzles_slug_date
  on public.daily_puzzles (game_slug, puzzle_date desc);

-- 2. User-Created "21 Things" Boards (Shareable Friend Links)
create table if not exists public.twenty_one_boards (
  id text primary key,
  title text not null,
  creator_name text not null,
  creator_bio text,
  items jsonb not null, -- Array of 21 strings (each <= 5 words / ~30 chars)
  raw_transcript text,
  is_daily boolean not null default false,
  puzzle_date date,
  created_at timestamptz not null default now()
);

create index if not exists idx_twenty_one_boards_created
  on public.twenty_one_boards (created_at desc);

-- 3. Friend Funnel Responses (21 -> 6 -> 3 -> 1 Journey + Reflection Note/Voice)
create table if not exists public.twenty_one_responses (
  id uuid primary key default gen_random_uuid(),
  board_id text not null,
  player_name text not null,
  pick_6 jsonb not null, -- Array of 6 selected items
  pick_3 jsonb not null, -- Array of 3 finalist items
  pick_1 text not null,  -- Ultimate #1 resonating item
  reflection_note text not null,
  voice_note_url text,   -- Optional base64/audio clip URL
  created_at timestamptz not null default now()
);

create index if not exists idx_twenty_one_responses_board
  on public.twenty_one_responses (board_id, created_at desc);

-- Row Level Security
alter table public.daily_puzzles enable row level security;
alter table public.twenty_one_boards enable row level security;
alter table public.twenty_one_responses enable row level security;

-- Row Level Security on daily_puzzles: Public SELECT, Game Master INSERT/UPDATE/DELETE
drop policy if exists "Public read daily_puzzles" on public.daily_puzzles;
create policy "Public read daily_puzzles"
  on public.daily_puzzles for select using (true);

drop policy if exists "Admin upsert daily_puzzles" on public.daily_puzzles;
drop policy if exists "Game masters insert daily_puzzles" on public.daily_puzzles;
drop policy if exists "Game masters update daily_puzzles" on public.daily_puzzles;
drop policy if exists "Game masters delete daily_puzzles" on public.daily_puzzles;
drop policy if exists "Game masters write daily_puzzles" on public.daily_puzzles;

create policy "Game masters insert daily_puzzles"
  on public.daily_puzzles
  for insert
  with check (
    lower(auth.jwt() ->> 'email') in ('lucas@soltheory.com', 'steve@soltheory.com')
  );

create policy "Game masters update daily_puzzles"
  on public.daily_puzzles
  for update
  using (
    lower(auth.jwt() ->> 'email') in ('lucas@soltheory.com', 'steve@soltheory.com')
  )
  with check (
    lower(auth.jwt() ->> 'email') in ('lucas@soltheory.com', 'steve@soltheory.com')
  );

create policy "Game masters delete daily_puzzles"
  on public.daily_puzzles
  for delete
  using (
    lower(auth.jwt() ->> 'email') in ('lucas@soltheory.com', 'steve@soltheory.com')
  );

drop policy if exists "Public read twenty_one_boards" on public.twenty_one_boards;
create policy "Public read twenty_one_boards"
  on public.twenty_one_boards for select using (true);

drop policy if exists "Anyone can create twenty_one_boards" on public.twenty_one_boards;
create policy "Anyone can create twenty_one_boards"
  on public.twenty_one_boards for insert with check (true);

drop policy if exists "Anyone can update twenty_one_boards" on public.twenty_one_boards;
create policy "Anyone can update twenty_one_boards"
  on public.twenty_one_boards for update using (true) with check (true);

drop policy if exists "Public read twenty_one_responses" on public.twenty_one_responses;
create policy "Public read twenty_one_responses"
  on public.twenty_one_responses for select using (true);

drop policy if exists "Anyone can submit twenty_one_responses" on public.twenty_one_responses;
create policy "Anyone can submit twenty_one_responses"
  on public.twenty_one_responses for insert with check (true);

-- 4. User Profiles & Synced Game Stats (uuid PK 1:1 with auth.users)
create table if not exists public.user_profiles (
  id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  email text not null constraint user_profiles_email_trimmed_lower_check check (email = lower(btrim(email))),
  display_name text not null,
  handle text not null,
  avatar_color text not null default '#F9D423',
  role text not null default 'user' check (role in ('game_master', 'admin', 'user')),
  is_banned boolean not null default false,
  banned_at timestamptz,
  banned_reason text,
  connect5_stats jsonb not null default '{}'::jsonb,
  twenty_one_stats jsonb not null default '{}'::jsonb,
  recent_picks jsonb not null default '[]'::jsonb,
  created_board_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Idempotent adjustments for existing installations
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_profiles'
      and column_name = 'id'
      and data_type <> 'uuid'
  ) then
    alter table public.user_profiles
      alter column id type uuid using id::uuid;
  end if;
end;
$$;

alter table public.user_profiles
  alter column id set default auth.uid();

alter table public.user_profiles
  drop constraint if exists user_profiles_id_fkey;

alter table public.user_profiles
  add constraint user_profiles_id_fkey
  foreign key (id) references auth.users(id) on delete cascade;

alter table public.user_profiles
  drop constraint if exists user_profiles_email_trimmed_lower_check;

alter table public.user_profiles
  add constraint user_profiles_email_trimmed_lower_check
  check (email = lower(btrim(email)));

drop index if exists public.idx_user_profiles_lower_email;
create unique index if not exists idx_user_profiles_lower_email
  on public.user_profiles (lower(email));

create index if not exists idx_user_profiles_role
  on public.user_profiles (role);

create index if not exists idx_user_profiles_is_banned
  on public.user_profiles (is_banned);

-- Seed / enforce initial Game Masters
update public.user_profiles
  set role = 'game_master', is_banned = false, banned_at = null, banned_reason = null
  where lower(email) in ('lucas@soltheory.com', 'steve@soltheory.com', 'luke@soltheory.com');

-- Row Level Security on user_profiles: Public SELECT, User-Owned INSERT/UPDATE/DELETE
alter table public.user_profiles enable row level security;

drop policy if exists "Public read user_profiles" on public.user_profiles;
create policy "Public read user_profiles"
  on public.user_profiles for select using (true);

drop policy if exists "Anyone can insert user_profiles" on public.user_profiles;
drop policy if exists "Users can insert own profile" on public.user_profiles;
create policy "Users can insert own profile"
  on public.user_profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Anyone can update user_profiles" on public.user_profiles;
drop policy if exists "Users can update own profile" on public.user_profiles;
create policy "Users can update own profile"
  on public.user_profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Users can delete own profile" on public.user_profiles;
create policy "Users can delete own profile"
  on public.user_profiles for delete
  using (auth.uid() = id);

-- 5. Table & Schema Grants for Supabase Publishable / Anon / Authenticated Roles
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.daily_puzzles to anon, authenticated;
grant select, insert, update, delete on table public.twenty_one_boards to anon, authenticated;
grant select, insert, update, delete on table public.twenty_one_responses to anon, authenticated;
grant select, insert, update, delete on table public.user_profiles to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;
alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated;
alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated;

-- 6. Enable Realtime Publication & Replica Identity
do $$
begin
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'daily_puzzles') then
    alter table public.daily_puzzles replica identity full;
  end if;

  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'twenty_one_boards') then
    alter table public.twenty_one_boards replica identity full;
  end if;

  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'twenty_one_responses') then
    alter table public.twenty_one_responses replica identity full;
  end if;

  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'daily_puzzles') then
      alter publication supabase_realtime add table public.daily_puzzles;
    end if;

    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'twenty_one_boards') then
      alter publication supabase_realtime add table public.twenty_one_boards;
    end if;

    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'twenty_one_responses') then
      alter publication supabase_realtime add table public.twenty_one_responses;
    end if;
  end if;
end;
$$;

-- 7. Trigger to automatically create and sync user_profiles on auth.users insert
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (
    id,
    email,
    display_name,
    handle,
    avatar_color,
    role
  )
  values (
    new.id,
    lower(btrim(new.email)),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'handle', '@' || lower(regexp_replace(split_part(new.email, '@', 1), '[^a-z0-9_]', '_', 'g'))),
    coalesce(new.raw_user_meta_data->>'avatar_color', '#F9D423'),
    case
      when lower(btrim(new.email)) in ('lucas@soltheory.com', 'steve@soltheory.com', 'luke@soltheory.com') then 'game_master'
      else 'user'
    end
  )
  on conflict (id) do update set
    email = lower(btrim(excluded.email)),
    role = case
      when lower(btrim(excluded.email)) in ('lucas@soltheory.com', 'steve@soltheory.com', 'luke@soltheory.com') then 'game_master'
      else public.user_profiles.role
    end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
