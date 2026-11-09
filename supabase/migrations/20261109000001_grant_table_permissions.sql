-- =============================================================================
-- Grant explicit table & schema permissions to anon & authenticated roles
-- so Supabase Publishable Keys (sb_publishable_...) can query RLS-enabled tables.
-- =============================================================================

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
