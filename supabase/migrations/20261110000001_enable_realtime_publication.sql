-- =============================================================================
-- Migration: 20261110000001_enable_realtime_publication.sql
-- Enables replica identity FULL and adds daily_puzzles, twenty_one_boards,
-- and twenty_one_responses to supabase_realtime publication.
-- Idempotent PL/pgSQL block for cross-device real-time WebSocket delivery.
-- =============================================================================

do $$
begin
  -- Set replica identity full so old and new records are fully available to Realtime
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'daily_puzzles') then
    alter table public.daily_puzzles replica identity full;
  end if;

  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'twenty_one_boards') then
    alter table public.twenty_one_boards replica identity full;
  end if;

  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'twenty_one_responses') then
    alter table public.twenty_one_responses replica identity full;
  end if;

  -- Add tables to supabase_realtime publication if not already present
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
