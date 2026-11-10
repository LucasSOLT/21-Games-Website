-- =============================================================================
-- Migration: 20261110000002_auth_security_lockdown.sql
-- Milestone M2.5-B2: P0 Auth & Login Security Overhaul
--
-- 1. Cleans up test/mock/legacy rows from auth.users and public.user_profiles
--    (including any test lucas@soltheory.com row so Lucas can set a permanent password).
-- 2. Migrates public.user_profiles.id to uuid PK referencing auth.users(id) ON DELETE CASCADE.
-- 3. Enforces email normalization:
--    - email = lower(btrim(email)) check constraint
--    - unique index on lower(email)
-- 4. Hardens Postgres Row Level Security on public.daily_puzzles:
--    - Anon / Public SELECT allowed (read-only puzzles).
--    - INSERT, UPDATE, DELETE strictly locked to Game Masters:
--      lower(auth.jwt() ->> 'email') in ('lucas@soltheory.com', 'steve@soltheory.com').
-- 5. Hardens Postgres Row Level Security on public.user_profiles:
--    - Public SELECT allowed (profile cards, stats, friend links).
--    - INSERT, UPDATE, DELETE strictly locked to authenticated user (auth.uid() = id).
-- 6. Adds auth.users trigger to automatically create/sync public.user_profiles on signup.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Step 1: Clean up test/mock/legacy rows
-- -----------------------------------------------------------------------------
-- 1a. Delete test accounts in auth.users (including stale lucas@soltheory.com)
-- so Lucas can create a clean permanent account with a verified password.
delete from auth.users
  where lower(email) in (
    'lucas@soltheory.com',
    'test@example.com',
    'mock@example.com',
    'probe@example.com',
    'challenger@example.com',
    'unauthorized_probe@soltheory.com',
    'fake_id@example.com',
    'bademail@example.com'
  );

-- 1b. Delete all non-UUID ID rows from public.user_profiles using regex
delete from public.user_profiles
  where id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- 1c. Delete known test emails from public.user_profiles
delete from public.user_profiles
  where lower(btrim(email)) in (
    'test@example.com',
    'lucas@soltheory.com',
    'mock@example.com',
    'probe@example.com',
    'challenger@example.com',
    'unauthorized_probe@soltheory.com',
    'fake_id@example.com',
    'bademail@example.com'
  );

-- 1d. Delete orphaned user_profiles with no corresponding row in auth.users
delete from public.user_profiles
  where id::uuid not in (select id from auth.users);

-- -----------------------------------------------------------------------------
-- Step 2: Schema Migration for public.user_profiles (uuid PK referencing auth.users)
-- -----------------------------------------------------------------------------
-- Convert id from text to uuid if currently text
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

-- Set default id to auth.uid()
alter table public.user_profiles
  alter column id set default auth.uid();

-- Ensure FK constraint to auth.users(id) ON DELETE CASCADE
alter table public.user_profiles
  drop constraint if exists user_profiles_id_fkey;

alter table public.user_profiles
  add constraint user_profiles_id_fkey
  foreign key (id) references auth.users(id) on delete cascade;

-- -----------------------------------------------------------------------------
-- Step 3: Enforce email normalization constraints on public.user_profiles
-- -----------------------------------------------------------------------------
-- Sanitize any existing email values to be lowercased and trimmed
update public.user_profiles
  set email = lower(btrim(email))
  where email <> lower(btrim(email));

-- Check constraint: email = lower(btrim(email))
alter table public.user_profiles
  drop constraint if exists user_profiles_email_trimmed_lower_check;

alter table public.user_profiles
  add constraint user_profiles_email_trimmed_lower_check
  check (email = lower(btrim(email)));

-- Unique index on lower(email)
drop index if exists public.idx_user_profiles_lower_email;

create unique index if not exists idx_user_profiles_lower_email
  on public.user_profiles (lower(email));

-- -----------------------------------------------------------------------------
-- Step 4: Postgres RLS Lockdown on public.daily_puzzles
-- -----------------------------------------------------------------------------
alter table public.daily_puzzles enable row level security;

-- Drop legacy / permissive policies
drop policy if exists "Admin upsert daily_puzzles" on public.daily_puzzles;
drop policy if exists "Game masters insert daily_puzzles" on public.daily_puzzles;
drop policy if exists "Game masters update daily_puzzles" on public.daily_puzzles;
drop policy if exists "Game masters delete daily_puzzles" on public.daily_puzzles;
drop policy if exists "Game masters write daily_puzzles" on public.daily_puzzles;
drop policy if exists "Public read daily_puzzles" on public.daily_puzzles;

-- 1. Anon / Authenticated SELECT permitted (public read-only puzzle access)
create policy "Public read daily_puzzles"
  on public.daily_puzzles
  for select
  using (true);

-- 2. INSERT strictly restricted to verified Game Masters
create policy "Game masters insert daily_puzzles"
  on public.daily_puzzles
  for insert
  with check (
    lower(auth.jwt() ->> 'email') in ('lucas@soltheory.com', 'steve@soltheory.com')
  );

-- 3. UPDATE strictly restricted to verified Game Masters
create policy "Game masters update daily_puzzles"
  on public.daily_puzzles
  for update
  using (
    lower(auth.jwt() ->> 'email') in ('lucas@soltheory.com', 'steve@soltheory.com')
  )
  with check (
    lower(auth.jwt() ->> 'email') in ('lucas@soltheory.com', 'steve@soltheory.com')
  );

-- 4. DELETE strictly restricted to verified Game Masters
create policy "Game masters delete daily_puzzles"
  on public.daily_puzzles
  for delete
  using (
    lower(auth.jwt() ->> 'email') in ('lucas@soltheory.com', 'steve@soltheory.com')
  );

-- -----------------------------------------------------------------------------
-- Step 5: Postgres RLS Lockdown on public.user_profiles
-- -----------------------------------------------------------------------------
alter table public.user_profiles enable row level security;

drop policy if exists "Public read user_profiles" on public.user_profiles;
drop policy if exists "Anyone can insert user_profiles" on public.user_profiles;
drop policy if exists "Anyone can update user_profiles" on public.user_profiles;
drop policy if exists "Users can insert own profile" on public.user_profiles;
drop policy if exists "Users can update own profile" on public.user_profiles;
drop policy if exists "Users can delete own profile" on public.user_profiles;

-- 1. Public read for user profiles (viewing profile cards, friend stats, etc.)
create policy "Public read user_profiles"
  on public.user_profiles
  for select
  using (true);

-- 2. Authenticated users can insert their own profile matching auth.uid()
create policy "Users can insert own profile"
  on public.user_profiles
  for insert
  with check (
    auth.uid() = id
  );

-- 3. Authenticated users can update their own profile matching auth.uid()
create policy "Users can update own profile"
  on public.user_profiles
  for update
  using (
    auth.uid() = id
  )
  with check (
    auth.uid() = id
  );

-- 4. Authenticated users can delete their own profile matching auth.uid()
create policy "Users can delete own profile"
  on public.user_profiles
  for delete
  using (
    auth.uid() = id
  );

-- -----------------------------------------------------------------------------
-- Step 6: Trigger to automatically create and sync user_profiles on auth.users insert
-- -----------------------------------------------------------------------------
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
