-- =============================================================================
-- Migration: 20261111000002_profile_trigger_hardening.sql
-- Milestone M1 (Step 2.5) — iteration 2 fix for finding H1.
--
-- PROBLEM (20261111000001): enforce_user_profile_security() is SECURITY DEFINER,
-- so `current_user` inside it is always the function owner (postgres) and the
-- "internal caller" branch fired for EVERY API call. It also read only the legacy
-- GUC `request.jwt.claim.role`, which PostgREST (PostgreSQL >= 14) no longer sets
-- (it sets the JSON GUC `request.jwt.claims`). Net effect: an authenticated user
-- could PATCH their own role to 'admin', un-ban themselves, or change their email.
--
-- FIX (defence in depth, all idempotent):
--   1. The guard now derives the caller from the JWT claims (JSON GUC first, legacy
--      GUC second) + auth.uid() + session_user. The privileged bypass applies ONLY to
--      service_role, or to a trusted DB-internal session (no JWT context at all AND
--      the connection is not an API connection: migrations, SQL editor, GoTrue).
--      anon / authenticated callers NEVER bypass.
--   2. Column-level privileges: `authenticated` may only INSERT/UPDATE the safe,
--      user-editable columns of public.user_profiles. role / is_banned / banned_* /
--      email / id / created_at can no longer be written through the API at all.
--   3. Root Game Masters change roles / ban status through two SECURITY DEFINER RPCs
--      (admin_set_user_role, admin_set_user_banned) which re-check
--      is_root_game_master() server-side and report the number of rows affected.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Corrected protection trigger
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- 2. Column-level privileges (protected columns are not writable via the API)
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- 3. Root Game Master RPCs for role / ban management (rows-affected aware)
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- 4. Purge known pre-lockdown automated test probe rows (idempotent)
-- -----------------------------------------------------------------------------
delete from public.twenty_one_boards
where id in ('custom-test-1', 'custom-test-2', '21t-e2eanon0')
  and created_by is null;

delete from public.twenty_one_responses
where (board_id = '2026-11-08' and player_name = 'Alex Clean' and reflection_note = 'A wonderful peaceful puzzle.')
   or (board_id = 'custom-board-999' and player_name = 'Casual Player');
