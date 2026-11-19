-- ============================================================================
-- Migration 20261119000001: Site-Wide Audit Security & Editorial Timezone Polish
-- 1. Restrict public `daily_puzzles` SELECT to `puzzle_date <= (current_date + 1)`
--    (accommodating UTC+14 local "today") unless caller is a root Game Master or
--    active Admin, preventing scraping of future M+1 / M+2 scheduled puzzle answers.
-- 2. Anchor Admin future-date edit checks to US Pacific editorial date so US
--    evening edits (after 00:00 UTC) for local tomorrow are never falsely rejected.
-- ============================================================================

drop policy if exists "daily_puzzles_select_public" on public.daily_puzzles;
create policy "daily_puzzles_select_public"
  on public.daily_puzzles
  for select
  to anon, authenticated
  using (
    puzzle_date <= (current_date + 1)
    or public.is_root_game_master()
    or public.is_active_admin()
  );

drop policy if exists "daily_puzzles_insert_authorized" on public.daily_puzzles;
create policy "daily_puzzles_insert_authorized"
  on public.daily_puzzles
  for insert
  to authenticated
  with check (
    public.is_root_game_master()
    or (
      public.is_active_admin()
      and puzzle_date > (now() at time zone 'America/Los_Angeles')::date
    )
  );

drop policy if exists "daily_puzzles_update_authorized" on public.daily_puzzles;
create policy "daily_puzzles_update_authorized"
  on public.daily_puzzles
  for update
  to authenticated
  using (
    public.is_root_game_master()
    or (
      public.is_active_admin()
      and puzzle_date > (now() at time zone 'America/Los_Angeles')::date
    )
  )
  with check (
    public.is_root_game_master()
    or (
      public.is_active_admin()
      and puzzle_date > (now() at time zone 'America/Los_Angeles')::date
    )
  );
