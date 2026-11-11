-- =============================================================================
-- SOL GaMES (21games.ai) — Supabase Postgres Schema
-- Architecture: Vercel (Static/Edge Frontend) + Supabase Postgres
-- Zero Firebase/Firestore dependencies.
-- Updated for Milestone M1 (Step 2.5 P0 Auth & RLS Security Lockdown)
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
  created_by text default (auth.uid()::text),
  created_at timestamptz not null default now()
);

alter table public.twenty_one_boards
  add column if not exists raw_transcript text,
  add column if not exists is_daily boolean not null default false,
  add column if not exists puzzle_date date,
  add column if not exists created_by text default (auth.uid()::text);

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

-- Enforce initial Game Masters strictly: Lucas & Steve only
update public.user_profiles
  set role = 'user'
  where role = 'game_master'
    and lower(btrim(email)) not in ('lucas@soltheory.com', 'steve@soltheory.com');

update public.user_profiles
  set role = 'game_master', is_banned = false, banned_at = null, banned_reason = null
  where lower(btrim(email)) in ('lucas@soltheory.com', 'steve@soltheory.com');

-- 5. STABLE SECURITY DEFINER Helper Functions
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

-- 6. Trigger: Privilege-Escalation & Ban-Tampering Guard on user_profiles
create or replace function public.enforce_user_profile_security()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  claims_text text := nullif(current_setting('request.jwt.claims', true), '');
  claims jsonb := case when claims_text is null then '{}'::jsonb else claims_text::jsonb end;
  jwt_role text := coalesce(
    nullif(auth.role(), ''),
    nullif(claims ->> 'role', ''),
    nullif(current_setting('request.jwt.claim.role', true), ''),
    ''
  );
  caller_uid uuid := auth.uid();
  caller_email text := public.current_jwt_email();
  is_service boolean;
  is_internal boolean;
begin
  new.email := lower(btrim(new.email));

  -- service_role (server-side key) is trusted by definition.
  is_service := (jwt_role = 'service_role');

  -- Trusted DB-internal session: NO JWT context at all and not an API connection.
  -- (session_user is the login role; PostgREST connects as `authenticator`, so API
  -- traffic can never be classified as internal. `current_user` is deliberately NOT
  -- used: inside SECURITY DEFINER it is always the function owner.)
  is_internal := (
    jwt_role = ''
    and caller_uid is null
    and claims_text is null
    and session_user not in ('authenticator', 'anon', 'authenticated', 'service_role')
  );

  if is_service or is_internal then
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

  -- Every other caller (anon / authenticated / unknown) is an untrusted API user.
  if tg_op = 'INSERT' then
    if caller_uid is null
       or new.id is distinct from caller_uid
       or new.email is distinct from caller_email then
      raise exception 'Unauthorized user_profiles insert: id/email must match authenticated caller'
        using errcode = '42501';
    end if;

    if new.email in ('lucas@soltheory.com', 'steve@soltheory.com') then
      if not public.is_root_game_master() then
        raise exception 'Unauthorized Game Master profile insert'
          using errcode = '42501';
      end if;
      if coalesce(new.is_banned, false) = true
         or new.banned_at is not null
         or new.banned_reason is not null then
        raise exception 'Root Game Masters cannot be inserted in a banned state'
          using errcode = '42501';
      end if;
      new.role := 'game_master';
    else
      if coalesce(new.role, 'user') <> 'user'
         or coalesce(new.is_banned, false) = true
         or new.banned_at is not null
         or new.banned_reason is not null then
        raise exception 'Unauthorized user_profiles insert: cannot set privileged role or ban fields'
          using errcode = '42501';
      end if;
      new.role := 'user';
    end if;
    new.is_banned := false;
    new.banned_at := null;
    new.banned_reason := null;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if public.is_root_game_master() then
      if new.id is distinct from old.id then
        raise exception 'Profile id is immutable'
          using errcode = '42501';
      end if;
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

    if caller_uid is null or old.id is distinct from caller_uid then
      raise exception 'Unauthorized modification of another user profile'
        using errcode = '42501';
    end if;

    if old.is_banned = true then
      raise exception 'Suspended accounts cannot modify profile records'
        using errcode = '42501';
    end if;

    if new.id is distinct from old.id
       or new.role is distinct from old.role
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

-- 8. Enable Row Level Security & Drop Legacy Policies
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

-- 9. Least-Privilege Grants & Revokes
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

-- 9b. Column-level privileges + Game Master RPCs (migration 20261111000002)
revoke insert, update on table public.user_profiles from authenticated;
revoke insert, update on table public.user_profiles from anon;

grant insert (
  id, email, display_name, handle, avatar_color,
  connect5_stats, twenty_one_stats, recent_picks, created_board_ids, updated_at
) on table public.user_profiles to authenticated;

grant update (
  display_name, handle, avatar_color,
  connect5_stats, twenty_one_stats, recent_picks, created_board_ids, updated_at
) on table public.user_profiles to authenticated;

create or replace function public.admin_set_user_role(target_email text, new_role text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized text := lower(btrim(coalesce(target_email, '')));
  affected integer;
begin
  if not public.is_root_game_master() then
    raise exception 'Unauthorized: only root Game Masters can change user roles'
      using errcode = '42501';
  end if;
  if new_role is null or new_role not in ('user', 'admin', 'game_master') then
    raise exception 'Invalid role' using errcode = '22023';
  end if;
  if new_role = 'game_master'
     and normalized not in ('lucas@soltheory.com', 'steve@soltheory.com') then
    raise exception 'Only root Game Masters can hold the game_master role'
      using errcode = '42501';
  end if;
  if normalized in ('lucas@soltheory.com', 'steve@soltheory.com')
     and new_role <> 'game_master' then
    raise exception 'Root Game Masters cannot be demoted'
      using errcode = '42501';
  end if;

  update public.user_profiles
    set role = new_role,
        updated_at = now()
    where lower(btrim(email)) = normalized;
  get diagnostics affected = row_count;
  return affected;
end;
$$;

create or replace function public.admin_set_user_banned(
  target_email text,
  banned boolean,
  reason text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized text := lower(btrim(coalesce(target_email, '')));
  affected integer;
begin
  if not public.is_root_game_master() then
    raise exception 'Unauthorized: only root Game Masters can change ban status'
      using errcode = '42501';
  end if;
  if banned is null then
    raise exception 'banned must be true or false' using errcode = '22023';
  end if;
  if banned and normalized in ('lucas@soltheory.com', 'steve@soltheory.com') then
    raise exception 'Root Game Masters have permanent ban immunity'
      using errcode = '42501';
  end if;

  update public.user_profiles
    set is_banned = banned,
        banned_at = case when banned then now() else null end,
        banned_reason = case
          when banned then coalesce(nullif(btrim(reason), ''), 'Account suspended by Game Master.')
          else null
        end,
        updated_at = now()
    where lower(btrim(email)) = normalized;
  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke execute on function public.admin_set_user_role(text, text) from public, anon;
revoke execute on function public.admin_set_user_banned(text, boolean, text) from public, anon;
grant execute on function public.admin_set_user_role(text, text) to authenticated;
grant execute on function public.admin_set_user_banned(text, boolean, text) to authenticated;

-- 10. Strict Row Level Security Policies
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

-- 11. Enable Realtime Publication & Replica Identity
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
