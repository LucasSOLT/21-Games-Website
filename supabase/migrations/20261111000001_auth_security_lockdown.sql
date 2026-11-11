-- =============================================================================
-- Migration: 20261111000001_auth_security_lockdown.sql
-- Milestone M1 (Step 2.5): Complete Auth & Postgres RLS Security Lockdown
--
-- Remediates remaining RLS, table-grant, and role-escalation gaps:
-- 1. Strictly locks root Game Masters to ('lucas@soltheory.com', 'steve@soltheory.com')
--    and demotes any non-whitelisted game_master rows.
-- 2. Reconciles twenty_one_boards, twenty_one_responses, and twenty_one_journeys schemas.
-- 3. Defines STABLE SECURITY DEFINER helper functions (current_jwt_email,
--    is_root_game_master, is_active_admin, is_current_user_banned).
-- 4. Installs BEFORE INSERT OR UPDATE trigger enforce_user_profile_security() on
--    public.user_profiles to block self-promotion to admin/game_master and ban tampering.
-- 5. Revokes anonymous write grants on daily_puzzles / twenty_one_boards and
--    revokes ALL anonymous grants on user_profiles (blocking email enumeration).
-- 6. Replaces permissive RLS policies across daily_puzzles, user_profiles,
--    twenty_one_boards, twenty_one_responses, and twenty_one_journeys.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Reconcile Table Schemas & Root Game Master Roster
-- -----------------------------------------------------------------------------
alter table public.twenty_one_boards
  add column if not exists raw_transcript text,
  add column if not exists is_daily boolean not null default false,
  add column if not exists puzzle_date date,
  add column if not exists created_by text default (auth.uid()::text);

create table if not exists public.twenty_one_responses (
  id uuid primary key default gen_random_uuid(),
  board_id text not null,
  player_name text not null,
  pick_6 jsonb not null,
  pick_3 jsonb not null,
  pick_1 text not null,
  reflection_note text not null,
  voice_note_url text,
  created_at timestamptz not null default now()
);

create index if not exists idx_twenty_one_responses_board
  on public.twenty_one_responses (board_id, created_at desc);

create table if not exists public.twenty_one_journeys (
  id uuid primary key default gen_random_uuid(),
  board_id text not null,
  player_name text not null,
  pick_6 jsonb not null,
  pick_3 jsonb not null,
  pick_1 text not null,
  reflection_note text not null,
  voice_note_url text,
  created_at timestamptz not null default now()
);

create index if not exists idx_twenty_one_journeys_board
  on public.twenty_one_journeys (board_id, created_at desc);

-- Demote any non-whitelisted game_master rows; enforce strictly Lucas & Steve
update public.user_profiles
  set role = 'user'
  where role = 'game_master'
    and lower(btrim(email)) not in ('lucas@soltheory.com', 'steve@soltheory.com');

update public.user_profiles
  set role = 'game_master',
      is_banned = false,
      banned_at = null,
      banned_reason = null
  where lower(btrim(email)) in ('lucas@soltheory.com', 'steve@soltheory.com');

-- -----------------------------------------------------------------------------
-- 2. STABLE SECURITY DEFINER Helper Functions for RLS
-- -----------------------------------------------------------------------------
create or replace function public.current_jwt_email()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select lower(btrim(coalesce(auth.jwt() ->> 'email', '')));
$$;

create or replace function public.is_root_game_master()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.role() = 'authenticated'
    and public.current_jwt_email() in ('lucas@soltheory.com', 'steve@soltheory.com')
    and not exists (
      select 1
      from public.user_profiles up
      where lower(btrim(up.email)) = public.current_jwt_email()
        and up.is_banned = true
    );
$$;

create or replace function public.is_active_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.role() = 'authenticated'
    and exists (
      select 1
      from public.user_profiles up
      where (
        up.id::text = auth.uid()::text
        or lower(btrim(up.email)) = public.current_jwt_email()
      )
        and up.role = 'admin'
        and up.is_banned = false
    );
$$;

create or replace function public.is_current_user_banned()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_profiles up
    where (
      up.id::text = auth.uid()::text
      or lower(btrim(up.email)) = public.current_jwt_email()
    )
      and up.is_banned = true
  );
$$;

grant execute on function public.current_jwt_email() to anon, authenticated;
grant execute on function public.is_root_game_master() to anon, authenticated;
grant execute on function public.is_active_admin() to anon, authenticated;
grant execute on function public.is_current_user_banned() to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3. Trigger: Privilege-Escalation & Ban-Tampering Guard on user_profiles
-- -----------------------------------------------------------------------------
create or replace function public.enforce_user_profile_security()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  jwt_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
begin
  new.email := lower(btrim(new.email));

  -- Allow internal Postgres / service_role / GoTrue auth trigger execution
  if current_user in ('postgres', 'supabase_admin', 'supabase_auth_admin')
     and jwt_role not in ('anon', 'authenticated') then
    if new.email in ('lucas@soltheory.com', 'steve@soltheory.com') then
      new.role := 'game_master';
      new.is_banned := false;
      new.banned_at := null;
      new.banned_reason := null;
    elsif new.role = 'game_master' then
      new.role := 'user';
    end if;
    return new;
  end if;

  if jwt_role = 'service_role' then
    if new.email not in ('lucas@soltheory.com', 'steve@soltheory.com') and new.role = 'game_master' then
      new.role := 'user';
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.email in ('lucas@soltheory.com', 'steve@soltheory.com') then
      if not public.is_root_game_master() then
        raise exception 'Unauthorized Game Master profile insert'
          using errcode = '42501';
      end if;
      new.role := 'game_master';
    else
      new.role := 'user';
    end if;
    new.is_banned := false;
    new.banned_at := null;
    new.banned_reason := null;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if public.is_root_game_master() then
      if old.email in ('lucas@soltheory.com', 'steve@soltheory.com')
         and (new.role <> 'game_master' or new.is_banned = true) then
        raise exception 'Root Game Masters cannot be demoted or banned'
          using errcode = '42501';
      end if;
      if new.email not in ('lucas@soltheory.com', 'steve@soltheory.com')
         and new.role = 'game_master' then
        raise exception 'Only authorized root Game Masters can hold the game_master role'
          using errcode = '42501';
      end if;
      if new.email is distinct from old.email then
        raise exception 'Profile email address is immutable'
          using errcode = '42501';
      end if;
      return new;
    end if;

    if old.is_banned = true then
      raise exception 'Suspended accounts cannot modify profile records'
        using errcode = '42501';
    end if;

    if new.role is distinct from old.role
       or new.email is distinct from old.email
       or new.is_banned is distinct from old.is_banned
       or new.banned_at is distinct from old.banned_at
       or new.banned_reason is distinct from old.banned_reason then
      raise exception 'Unauthorized modification of protected user_profiles columns'
        using errcode = '42501';
    end if;

    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_user_profile_security on public.user_profiles;
create trigger trg_enforce_user_profile_security
  before insert or update on public.user_profiles
  for each row execute function public.enforce_user_profile_security();

-- Update auth.users signup trigger to strictly recognize only Lucas & Steve
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
      when lower(btrim(new.email)) in ('lucas@soltheory.com', 'steve@soltheory.com') then 'game_master'
      else 'user'
    end
  )
  on conflict (id) do update set
    email = lower(btrim(excluded.email)),
    role = case
      when lower(btrim(excluded.email)) in ('lucas@soltheory.com', 'steve@soltheory.com') then 'game_master'
      else public.user_profiles.role
    end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 4. Enable RLS & Drop All Legacy Permissive Policies
-- -----------------------------------------------------------------------------
alter table public.daily_puzzles enable row level security;
alter table public.user_profiles enable row level security;
alter table public.twenty_one_boards enable row level security;
alter table public.twenty_one_responses enable row level security;
alter table public.twenty_one_journeys enable row level security;

do $$
declare
  pol record;
begin
  for pol in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'daily_puzzles',
        'user_profiles',
        'twenty_one_boards',
        'twenty_one_responses',
        'twenty_one_journeys'
      )
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      pol.policyname,
      pol.schemaname,
      pol.tablename
    );
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. Least-Privilege Table Grants & Revokes
-- -----------------------------------------------------------------------------
revoke insert, update, delete on table public.daily_puzzles from anon;
revoke select, insert, update, delete on table public.user_profiles from anon;
revoke insert, update, delete on table public.twenty_one_boards from anon;
revoke update, delete on table public.twenty_one_responses from anon;
revoke update, delete on table public.twenty_one_journeys from anon;
revoke delete on table public.user_profiles from authenticated;

grant usage on schema public to anon, authenticated;
grant select on table public.daily_puzzles to anon, authenticated;
grant insert, update, delete on table public.daily_puzzles to authenticated;
grant select, insert, update on table public.user_profiles to authenticated;
grant select on table public.twenty_one_boards to anon, authenticated;
grant insert, update, delete on table public.twenty_one_boards to authenticated;
grant select, insert on table public.twenty_one_responses to anon, authenticated;
grant update, delete on table public.twenty_one_responses to authenticated;
grant select, insert on table public.twenty_one_journeys to anon, authenticated;
grant update, delete on table public.twenty_one_journeys to authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

alter default privileges in schema public
  revoke insert, update, delete on tables from anon;
alter default privileges in schema public
  grant select on tables to anon;
alter default privileges in schema public
  grant select, insert, update on tables to authenticated;

-- -----------------------------------------------------------------------------
-- 6. Strict Row Level Security Policies
-- -----------------------------------------------------------------------------

-- A. public.daily_puzzles
create policy "daily_puzzles_select_public"
  on public.daily_puzzles
  for select
  to anon, authenticated
  using (true);

create policy "daily_puzzles_insert_authorized"
  on public.daily_puzzles
  for insert
  to authenticated
  with check (
    public.is_root_game_master()
    or (public.is_active_admin() and puzzle_date > current_date)
  );

create policy "daily_puzzles_update_authorized"
  on public.daily_puzzles
  for update
  to authenticated
  using (
    public.is_root_game_master()
    or (public.is_active_admin() and puzzle_date > current_date)
  )
  with check (
    public.is_root_game_master()
    or (public.is_active_admin() and puzzle_date > current_date)
  );

create policy "daily_puzzles_delete_gm_only"
  on public.daily_puzzles
  for delete
  to authenticated
  using (public.is_root_game_master());

-- B. public.user_profiles (NO anonymous SELECT; own row or verified GM only)
create policy "user_profiles_select_own_or_gm"
  on public.user_profiles
  for select
  to authenticated
  using (
    public.is_root_game_master()
    or id::text = auth.uid()::text
    or lower(btrim(email)) = public.current_jwt_email()
  );

create policy "user_profiles_insert_own"
  on public.user_profiles
  for insert
  to authenticated
  with check (
    id::text = auth.uid()::text
    and lower(btrim(email)) = public.current_jwt_email()
  );

create policy "user_profiles_update_own_or_gm"
  on public.user_profiles
  for update
  to authenticated
  using (
    public.is_root_game_master()
    or id::text = auth.uid()::text
    or lower(btrim(email)) = public.current_jwt_email()
  )
  with check (
    public.is_root_game_master()
    or (
      id::text = auth.uid()::text
      and lower(btrim(email)) = public.current_jwt_email()
      and is_banned = false
    )
  );

create policy "user_profiles_delete_gm_only"
  on public.user_profiles
  for delete
  to authenticated
  using (
    public.is_root_game_master()
    and lower(btrim(email)) not in ('lucas@soltheory.com', 'steve@soltheory.com')
  );

-- C. public.twenty_one_boards (Public SELECT, non-banned authenticated INSERT, GM UPDATE/DELETE)
create policy "twenty_one_boards_select_public"
  on public.twenty_one_boards
  for select
  to anon, authenticated
  using (true);

create policy "twenty_one_boards_insert_authenticated"
  on public.twenty_one_boards
  for insert
  to authenticated
  with check (
    auth.role() = 'authenticated'
    and not public.is_current_user_banned()
    and char_length(btrim(id)) between 1 and 128
    and char_length(btrim(title)) between 1 and 200
    and jsonb_typeof(items) = 'array'
    and jsonb_array_length(items) = 21
  );

create policy "twenty_one_boards_update_gm_only"
  on public.twenty_one_boards
  for update
  to authenticated
  using (public.is_root_game_master())
  with check (public.is_root_game_master());

create policy "twenty_one_boards_delete_gm_only"
  on public.twenty_one_boards
  for delete
  to authenticated
  using (public.is_root_game_master());

-- D. public.twenty_one_responses (Public SELECT, bounded INSERT, GM UPDATE/DELETE)
create policy "twenty_one_responses_select_public"
  on public.twenty_one_responses
  for select
  to anon, authenticated
  using (true);

create policy "twenty_one_responses_insert_bounded"
  on public.twenty_one_responses
  for insert
  to anon, authenticated
  with check (
    char_length(btrim(board_id)) between 1 and 128
    and char_length(btrim(player_name)) between 1 and 80
    and char_length(btrim(pick_1)) between 1 and 300
    and char_length(coalesce(reflection_note, '')) <= 2000
    and (voice_note_url is null or char_length(voice_note_url) <= 1048576)
    and jsonb_typeof(pick_6) = 'array'
    and jsonb_array_length(pick_6) <= 6
    and jsonb_typeof(pick_3) = 'array'
    and jsonb_array_length(pick_3) <= 3
  );

create policy "twenty_one_responses_update_gm_only"
  on public.twenty_one_responses
  for update
  to authenticated
  using (public.is_root_game_master())
  with check (public.is_root_game_master());

create policy "twenty_one_responses_delete_gm_only"
  on public.twenty_one_responses
  for delete
  to authenticated
  using (public.is_root_game_master());

-- E. public.twenty_one_journeys (Mirrored bounded policies)
create policy "twenty_one_journeys_select_public"
  on public.twenty_one_journeys
  for select
  to anon, authenticated
  using (true);

create policy "twenty_one_journeys_insert_bounded"
  on public.twenty_one_journeys
  for insert
  to anon, authenticated
  with check (
    char_length(btrim(board_id)) between 1 and 128
    and char_length(btrim(player_name)) between 1 and 80
    and char_length(btrim(pick_1)) between 1 and 300
    and char_length(coalesce(reflection_note, '')) <= 2000
    and (voice_note_url is null or char_length(voice_note_url) <= 1048576)
    and jsonb_typeof(pick_6) = 'array'
    and jsonb_array_length(pick_6) <= 6
    and jsonb_typeof(pick_3) = 'array'
    and jsonb_array_length(pick_3) <= 3
  );

create policy "twenty_one_journeys_update_gm_only"
  on public.twenty_one_journeys
  for update
  to authenticated
  using (public.is_root_game_master())
  with check (public.is_root_game_master());

create policy "twenty_one_journeys_delete_gm_only"
  on public.twenty_one_journeys
  for delete
  to authenticated
  using (public.is_root_game_master());
