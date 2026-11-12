-- =============================================================================
-- Migration: 20261112000003_auth_auto_confirm_and_gm_restore.sql
--
-- 1. Ensures every existing and future account in auth.users has email_confirmed_at
--    populated immediately (via BEFORE INSERT trigger on auth.users + one-time backfill)
--    so new and existing players can sign in immediately without getting blocked by
--    unconfirmed email state.
-- 2. Reconciles public.user_profiles with auth.users for all existing accounts.
-- 3. Strictly enforces that ONLY ('lucas@soltheory.com', 'steve@soltheory.com') hold
--    role = 'game_master' (unbanned), and all other accounts hold role = 'user'.
-- =============================================================================

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'auth'
      and table_name = 'users'
      and column_name = 'email_confirmed_at'
  ) then
    alter table auth.users add column email_confirmed_at timestamptz;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'auth'
      and table_name = 'users'
      and column_name = 'updated_at'
  ) then
    alter table auth.users add column updated_at timestamptz default now();
  end if;
end;
$$;

-- 1. BEFORE INSERT trigger on auth.users to auto-confirm new signups immediately
create or replace function public.auto_confirm_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if new.email_confirmed_at is null then
    new.email_confirmed_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_autoconfirm on auth.users;
create trigger on_auth_user_autoconfirm
  before insert on auth.users
  for each row execute function public.auto_confirm_auth_user();

-- 2. Confirm all existing unconfirmed users in auth.users
update auth.users
  set email_confirmed_at = coalesce(email_confirmed_at, now()),
      updated_at = now()
  where email_confirmed_at is null;

-- 3. Remove any stale user_profiles rows whose email collides with a different auth.users UUID
delete from public.user_profiles up
  using auth.users au
  where lower(btrim(up.email)) = lower(btrim(au.email))
    and up.id <> au.id;

-- 4. Backfill / reconcile public.user_profiles for every account in auth.users
insert into public.user_profiles (
  id,
  email,
  display_name,
  handle,
  avatar_color,
  role,
  is_banned,
  banned_at,
  banned_reason
)
select
  au.id,
  lower(btrim(au.email)),
  coalesce(
    nullif(btrim(au.raw_user_meta_data->>'display_name'), ''),
    split_part(lower(btrim(au.email)), '@', 1)
  ),
  coalesce(
    nullif(btrim(au.raw_user_meta_data->>'handle'), ''),
    '@' || lower(regexp_replace(split_part(lower(btrim(au.email)), '@', 1), '[^a-z0-9_]', '_', 'g'))
  ),
  coalesce(
    nullif(btrim(au.raw_user_meta_data->>'avatar_color'), ''),
    '#F9D423'
  ),
  case
    when lower(btrim(au.email)) in ('lucas@soltheory.com', 'steve@soltheory.com') then 'game_master'
    else 'user'
  end,
  false,
  null,
  null
from auth.users au
where au.email is not null and btrim(au.email) <> ''
on conflict (id) do update set
  email = lower(btrim(excluded.email)),
  role = case
    when lower(btrim(excluded.email)) in ('lucas@soltheory.com', 'steve@soltheory.com') then 'game_master'
    else 'user'
  end,
  is_banned = case
    when lower(btrim(excluded.email)) in ('lucas@soltheory.com', 'steve@soltheory.com') then false
    else public.user_profiles.is_banned
  end,
  banned_at = case
    when lower(btrim(excluded.email)) in ('lucas@soltheory.com', 'steve@soltheory.com') then null
    else public.user_profiles.banned_at
  end,
  banned_reason = case
    when lower(btrim(excluded.email)) in ('lucas@soltheory.com', 'steve@soltheory.com') then null
    else public.user_profiles.banned_reason
  end;

-- 5. Enforce role invariant across public.user_profiles:
--    lucas@soltheory.com & steve@soltheory.com = 'game_master' (unbanned)
--    everyone else = 'user'
update public.user_profiles
  set role = 'user'
  where lower(btrim(email)) not in ('lucas@soltheory.com', 'steve@soltheory.com')
    and role <> 'user';

update public.user_profiles
  set role = 'game_master',
      is_banned = false,
      banned_at = null,
      banned_reason = null
  where lower(btrim(email)) in ('lucas@soltheory.com', 'steve@soltheory.com');
