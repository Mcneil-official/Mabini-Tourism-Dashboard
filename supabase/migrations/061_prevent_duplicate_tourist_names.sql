-- ==============================================================================
-- 061_prevent_duplicate_tourist_names.sql
-- Enforces full-name uniqueness on public.tourists to prevent duplicate accounts
-- in the municipal diver registry.
--
-- Apply in Supabase SQL Editor (service role / postgres).
-- Idempotent: safe to run multiple times.
-- ==============================================================================

-- 1. Helper to normalize diver names: trim, collapse spaces, lowercase
create or replace function public.normalize_registration_name(p_name text)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select lower(btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')));
$$;

revoke all on function public.normalize_registration_name(text) from public;

-- 2. Availability probe callable from client applications (anon + authenticated)
create or replace function public.is_full_name_available(p_full_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_name text := public.normalize_registration_name(p_full_name);
begin
  if v_name = '' then
    return false;
  end if;

  return not exists (
    select 1
    from public.tourists t
    where public.normalize_registration_name(t.full_name) = v_name
  );
end;
$$;

revoke all on function public.is_full_name_available(text) from public;
grant execute on function public.is_full_name_available(text) to anon, authenticated;

-- 3. Trigger function to reject duplicate full names on insert/update
create or replace function public.reject_duplicate_registration_name()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_name text := public.normalize_registration_name(new.full_name);
begin
  if v_name = '' then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_name, 0));

  if exists (
    select 1
    from public.tourists t
    where public.normalize_registration_name(t.full_name) = v_name
      and t.id <> new.id
  ) then
    raise exception using
      errcode = '23505',
      message = 'An account with this diver name is already registered. Please log in.';
  end if;

  return new;
end;
$$;

revoke all on function public.reject_duplicate_registration_name() from public, anon, authenticated;

-- 4. Attach trigger to public.tourists
drop trigger if exists reject_duplicate_registration_name on public.tourists;
create trigger reject_duplicate_registration_name
  before insert or update of full_name on public.tourists
  for each row execute function public.reject_duplicate_registration_name();
