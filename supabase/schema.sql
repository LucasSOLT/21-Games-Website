-- =============================================================================
-- SOL GaMES (21games.ai) — Supabase Postgres Schema
-- Architecture: Vercel (Static/Edge Frontend) + Supabase Postgres
-- Zero Firebase/Firestore dependencies.
-- =============================================================================

create extension if not exists "pgcrypto";

-- 1. Daily & Admin Puzzles Table (Connect 5 & 21 Things)
create table if not exists public.daily_puzzles (
  id uuid primary key default gen_random_uuid(),
  game_slug text not null check (game_slug in ('21-things', 'connect-5')),
  puzzle_date date not null,
  puzzle_number integer not null,
  title text not null,
  author text not null default 'Lucas Huff',
  editor text not null default 'Stephen Huff',
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (game_slug, puzzle_date)
);

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

-- Row Level Security (Public read, anon insert/upsert for MVP social gameplay)
alter table public.daily_puzzles enable row level security;
alter table public.twenty_one_boards enable row level security;
alter table public.twenty_one_responses enable row level security;

drop policy if exists "Public read daily_puzzles" on public.daily_puzzles;
create policy "Public read daily_puzzles"
  on public.daily_puzzles for select using (true);

drop policy if exists "Admin upsert daily_puzzles" on public.daily_puzzles;
create policy "Admin upsert daily_puzzles"
  on public.daily_puzzles for all using (true) with check (true);

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

-- 4. User Profiles & Synced Game Stats (NYT Games-Style Account & Profile Viewer)
create table if not exists public.user_profiles (
  id text primary key,
  email text unique not null,
  display_name text not null,
  handle text not null,
  avatar_color text not null default '#F9D423',
  connect5_stats jsonb not null default '{}'::jsonb,
  twenty_one_stats jsonb not null default '{}'::jsonb,
  recent_picks jsonb not null default '[]'::jsonb,
  created_board_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_profiles_email
  on public.user_profiles (email);

alter table public.user_profiles enable row level security;

drop policy if exists "Public read user_profiles" on public.user_profiles;
create policy "Public read user_profiles"
  on public.user_profiles for select using (true);

drop policy if exists "Anyone can insert user_profiles" on public.user_profiles;
create policy "Anyone can insert user_profiles"
  on public.user_profiles for insert with check (true);

drop policy if exists "Anyone can update user_profiles" on public.user_profiles;
create policy "Anyone can update user_profiles"
  on public.user_profiles for update using (true) with check (true);

