-- ---------------------------------------------------------------------------
-- Migration 063: Secure Analytics Database Functions
-- Enforces public.is_to_staff() authorization check on analytics RPCs
-- and revokes direct execute access from anon and arbitrary authenticated users.
-- ---------------------------------------------------------------------------

-- 1. Revoke public/authenticated direct execute on internal analytics functions
revoke execute on function public._to_establishment(date, date) from public, anon, authenticated;
revoke execute on function public._to_operator(date, date) from public, anon, authenticated;
revoke execute on function public._to_overview(date, date) from public, anon, authenticated;

-- Allow only authenticated staff to execute via to_metrics dispatcher
grant execute on function public.to_metrics(text, date, date) to authenticated;
grant execute on function public.to_tourist_sample(date, date, text, text, text[]) to authenticated;

-- Ensure _to_establishment enforces staff verification
create or replace function public._to_establishment(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_res jsonb;
begin
  if not public.is_to_staff() then
    raise exception 'Not authorized: TO staff access required' using errcode = '42501';
  end if;

  with bounds as (
    select
      (p_from::timestamp at time zone 'Asia/Manila') as start_ts,
      ((p_to + 1)::timestamp at time zone 'Asia/Manila') as end_ts
  ),
  approved_resorts as (
    select distinct on (resort_name)
      resort_name, tourist_id, status
    from public.operator_applications
    order by resort_name, (lower(status) = 'approved') desc, created_at desc
  ),
  operator_map as (
    select distinct on (tourist_id)
      tourist_id, resort_name
    from public.operator_applications
    order by tourist_id, (lower(status) = 'approved') desc, created_at desc
  ),
  operator_names as (
    select t.id as operator_id,
      coalesce(nullif(trim(om.resort_name), ''), nullif(trim(t.full_name), ''), 'Unknown operator') as name
    from public.tourists t
    left join operator_map om on om.tourist_id = t.id
  ),
  current_m as (
    select m.id, m.operator_id, coalesce(d.divers, 0) as divers
    from public.dive_manifests m
    cross join bounds b
    left join (
      select manifest_id, count(*)::int as divers
      from public.manifest_divers
      group by manifest_id
    ) d on d.manifest_id = m.id
    where m.created_at >= b.start_ts and m.created_at < b.end_ts
  ),
  by_operator as (
    select
      oname.name as operator_name,
      count(cm.id)::int as trips,
      coalesce(sum(cm.divers), 0)::int as divers
    from current_m cm
    join operator_names oname on oname.operator_id = cm.operator_id
    group by oname.name
  ),
  active_operators as (
    select
      op.operator_id,
      oname.name as operator_name,
      op.passes_balance as pass_balance,
      coalesce(bo.trips, 0) as trips,
      coalesce(bo.divers, 0) as divers
    from public.operator_passes op
    join operator_names oname on oname.operator_id = op.operator_id
    left join by_operator bo on bo.operator_name = oname.name
    order by divers desc, trips desc, pass_balance desc
    limit 10
  ),
  pending_apps as (
    select count(*)::int as total
    from public.operator_applications
    where lower(status) = 'pending'
  ),
  total_pass_pool as (
    select coalesce(sum(passes_balance), 0)::int as total
    from public.operator_passes
  )
  select jsonb_build_object(
    'top_resorts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', operator_name,
        'trips', trips,
        'divers', divers,
        'pass_balance', pass_balance
      )) from active_operators
    ), '[]'::jsonb),
    'pending_applications', (select total from pending_apps),
    'total_resorts', (select count(distinct resort_name)::int from approved_resorts),
    'total_pass_pool', (select total from total_pass_pool)
  ) into v_res;

  return v_res;
end;
$$;

-- Ensure _to_operator enforces staff verification
create or replace function public._to_operator(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_res jsonb;
begin
  if not public.is_to_staff() then
    raise exception 'Not authorized: TO staff access required' using errcode = '42501';
  end if;

  with bounds as (
    select
      (p_from::timestamp at time zone 'Asia/Manila') as start_ts,
      ((p_to + 1)::timestamp at time zone 'Asia/Manila') as end_ts
  ),
  operator_map as (
    select distinct on (tourist_id)
      tourist_id, resort_name
    from public.operator_applications
    order by tourist_id, (lower(status) = 'approved') desc, created_at desc
  ),
  operator_names as (
    select t.id as operator_id,
      coalesce(nullif(trim(om.resort_name), ''), nullif(trim(t.full_name), ''), 'Unknown operator') as name
    from public.tourists t
    left join operator_map om on om.tourist_id = t.id
  ),
  current_m as (
    select m.id, m.operator_id, coalesce(d.divers, 0) as divers
    from public.dive_manifests m
    cross join bounds b
    left join (
      select manifest_id, count(*)::int as divers
      from public.manifest_divers
      group by manifest_id
    ) d on d.manifest_id = m.id
    where m.created_at >= b.start_ts and m.created_at < b.end_ts
  ),
  by_op as (
    select
      oname.name as operator_name,
      cm.operator_id,
      count(cm.id)::int as trips,
      coalesce(sum(cm.divers), 0)::int as divers
    from current_m cm
    join operator_names oname on oname.operator_id = cm.operator_id
    group by oname.name, cm.operator_id
  ),
  op_table as (
    select
      bo.operator_name,
      bo.trips,
      bo.divers,
      coalesce(op.passes_balance, 0)::int as pass_balance
    from by_op bo
    left join public.operator_passes op on op.operator_id = bo.operator_id
    order by bo.divers desc, bo.trips desc
    limit 20
  )
  select jsonb_build_object(
    'operators', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', operator_name,
        'trips', trips,
        'divers', divers,
        'pass_balance', pass_balance
      )) from op_table
    ), '[]'::jsonb),
    'active_count', (select count(distinct operator_id)::int from current_m),
    'total_trips', (select count(*)::int from current_m),
    'total_divers', (select coalesce(sum(divers), 0)::int from current_m)
  ) into v_res;

  return v_res;
end;
$$;

-- Ensure _to_overview enforces staff verification
create or replace function public._to_overview(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_res jsonb;
begin
  if not public.is_to_staff() then
    raise exception 'Not authorized: TO staff access required' using errcode = '42501';
  end if;

  with bounds as (
    select
      (p_from::timestamp at time zone 'Asia/Manila') as start_ts,
      ((p_to + 1)::timestamp at time zone 'Asia/Manila') as end_ts
  ),
  manifests_scoped as (
    select m.id, m.site_id, m.created_at
    from public.dive_manifests m
    cross join bounds b
    where m.created_at >= b.start_ts and m.created_at < b.end_ts
  ),
  divers_scoped as (
    select md.manifest_id, md.tourist_id, coalesce(nullif(trim(t.nationality), ''), 'Unknown') as nationality
    from public.manifest_divers md
    join manifests_scoped ms on ms.id = md.manifest_id
    left join public.tourists t on t.id = md.tourist_id
  ),
  nat_counts as (
    select nationality as name, count(*)::int as count
    from divers_scoped
    group by nationality
    order by count desc
    limit 10
  ),
  site_counts as (
    select ds.name, count(ms.id)::int as count
    from manifests_scoped ms
    join public.dive_sites ds on ds.id = ms.site_id
    group by ds.name
    order by count desc
    limit 10
  )
  select jsonb_build_object(
    'total_trips', (select count(*)::int from manifests_scoped),
    'total_divers', (select count(*)::int from divers_scoped),
    'nationality', coalesce((
      select jsonb_agg(jsonb_build_object('name', name, 'count', count))
      from nat_counts
    ), '[]'::jsonb),
    'sites', coalesce((
      select jsonb_agg(jsonb_build_object('name', name, 'count', count))
      from site_counts
    ), '[]'::jsonb)
  ) into v_res;

  return v_res;
end;
$$;
