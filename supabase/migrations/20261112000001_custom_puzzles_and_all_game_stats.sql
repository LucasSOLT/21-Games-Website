-- Migration 20261112000001: custom_puzzles short links + user_profiles.all_game_stats
-- Idempotent. Keeps Step 2.5 auth/RLS lockdown (role, is_banned, email, trigger) intact.

-- =============================================================================
-- custom_puzzles: compact `?b=<prefix>-<8chars>` friend-puzzle short links
-- (21t- / 17s- / 9r- / 6p- / c5-). RLS enabled + least-privilege grants.
-- =============================================================================
create table if not exists public.custom_puzzles (
  id text primary key
    constraint custom_puzzles_id_format_check
    check (id ~ '^(21t|17s|9r|6p|c5)-[a-z0-9]{8}$'),
  game_slug text not null
    constraint custom_puzzles_game_slug_check
    check (game_slug in ('21-things', '17-syllables', '9-rhymes', '6-pics', 'connect-5')),
  title text not null
    constraint custom_puzzles_title_length_check
    check (char_length(btrim(title)) between 1 and 200),
  creator_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  creator_name text not null
    constraint custom_puzzles_creator_name_length_check
    check (char_length(btrim(creator_name)) between 1 and 80),
  creator_handle text not null
    constraint custom_puzzles_creator_handle_length_check
    check (char_length(btrim(creator_handle)) between 1 and 60),
  payload jsonb not null
    constraint custom_puzzles_payload_shape_check
    check (jsonb_typeof(payload) = 'object' and pg_column_size(payload) <= 65536),
  created_at timestamptz not null default now(),
  constraint custom_puzzles_prefix_matches_game_check check (
    (game_slug = '21-things' and id like '21t-%')
    or (game_slug = '17-syllables' and id like '17s-%')
    or (game_slug = '9-rhymes' and id like '9r-%')
    or (game_slug = '6-pics' and id like '6p-%')
    or (game_slug = 'connect-5' and id like 'c5-%')
  )
);

create index if not exists idx_custom_puzzles_creator_id
  on public.custom_puzzles (creator_id, created_at desc);

alter table public.custom_puzzles enable row level security;

-- Default privileges would hand `authenticated` select/insert/update: reset explicitly.
revoke all on table public.custom_puzzles from anon, authenticated;
grant select on table public.custom_puzzles to anon, authenticated;
grant insert (id, game_slug, title, creator_id, creator_name, creator_handle, payload)
  on table public.custom_puzzles to authenticated;
grant delete on table public.custom_puzzles to authenticated;

drop policy if exists "custom_puzzles_select_public" on public.custom_puzzles;
drop policy if exists "custom_puzzles_insert_own_not_banned" on public.custom_puzzles;
drop policy if exists "custom_puzzles_delete_gm_only" on public.custom_puzzles;

create policy "custom_puzzles_select_public"
  on public.custom_puzzles
  for select
  to anon, authenticated
  using (true);

create policy "custom_puzzles_insert_own_not_banned"
  on public.custom_puzzles
  for insert
  to authenticated
  with check (
    auth.role() = 'authenticated'
    and creator_id = auth.uid()
    and not public.is_current_user_banned()
  );

create policy "custom_puzzles_delete_gm_only"
  on public.custom_puzzles
  for delete
  to authenticated
  using (public.is_root_game_master());

-- =============================================================================
-- user_profiles.all_game_stats: unified 9-game stats blob (synced by the client).
-- Only the data column is granted; role / is_banned / email locks stay untouched.
-- =============================================================================
alter table public.user_profiles
  add column if not exists all_game_stats jsonb not null default '{}'::jsonb;

grant insert (
  id, email, display_name, handle, avatar_color,
  connect5_stats, twenty_one_stats, all_game_stats, recent_picks, created_board_ids, updated_at
) on table public.user_profiles to authenticated;

grant update (all_game_stats) on table public.user_profiles to authenticated;
