-- 052_report_dive_types_analytics.sql
-- Aggregates dive activity by dive_type (Scuba, Fun Dive, Training, Intro Dive, Freediver)
-- for the official Reports tab and printable municipal tourism reports.
--
-- Idempotent: safe to run multiple times.
-- Apply in Supabase SQL Editor (service role / postgres).

create or replace function public._to_report(p_from date, p_to date)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with bounds as (
    select
      (p_from::timestamp at time zone 'Asia/Manila') as start_ts,
      ((p_to + 1)::timestamp at time zone 'Asia/Manila') as end_ts
  ),
  tourist_daily as (
    select coalesce(t.date_accredited, (t.created_at at time zone 'Asia/Manila')::date) as date,
      count(*)::int as tourists
    from public.tourists t, bounds b
    where t.id <> auth.uid()
      and coalesce(t.date_accredited, (t.created_at at time zone 'Asia/Manila')::date)
        between p_from and p_to
    group by 1
  ),
  operator_daily as (
    select (created_at at time zone 'Asia/Manila')::date as date, count(*)::int as operators
    from public.operator_applications, bounds b
    where created_at >= b.start_ts and created_at < b.end_ts
    group by 1
  ),
  current_manifests as (
    select
      m.id,
      coalesce(nullif(trim(m.dive_type), ''), 'Scuba') as dive_type,
      (m.created_at at time zone 'Asia/Manila')::date as date,
      coalesce(d.divers, 1) as divers
    from public.dive_manifests m
    cross join bounds b
    left join (
      select manifest_id, count(*)::int as divers
      from public.manifest_divers group by manifest_id
    ) d on d.manifest_id = m.id
    where m.created_at >= b.start_ts and m.created_at < b.end_ts
  ),
  manifest_daily as (
    select m.date, count(*)::int as manifestos,
      coalesce(sum(m.divers), 0)::int as divers
    from current_manifests m
    group by m.date
  ),
  dive_types as (
    select
      dive_type as name,
      count(*)::int as manifests,
      coalesce(sum(divers), 0)::int as count
    from current_manifests
    group by 1
    order by count desc
  ),
  revenue_daily as (
    select (created_at at time zone 'Asia/Manila')::date as date,
      coalesce(sum(amount), 0) as revenue
    from public.payment_transactions, bounds b
    where lower(status) = 'verified'
      and created_at >= b.start_ts and created_at < b.end_ts
    group by 1
  )
  select jsonb_build_object(
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', d.day::date,
        'tourists', coalesce(t.tourists, 0),
        'operators', coalesce(o.operators, 0),
        'manifestos', coalesce(m.manifestos, 0),
        'divers', coalesce(m.divers, 0),
        'revenue', coalesce(r.revenue, 0)
      ) order by d.day)
      from generate_series(p_from, p_to, interval '1 day') d(day)
      left join tourist_daily t on t.date = d.day::date
      left join operator_daily o on o.date = d.day::date
      left join manifest_daily m on m.date = d.day::date
      left join revenue_daily r on r.date = d.day::date
    ), '[]'::jsonb),
    'diveTypes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', name,
        'count', count,
        'manifests', manifests
      ) order by count desc)
      from dive_types
    ), '[]'::jsonb)
  );
$$;

-- Verification query (run as staff):
-- select public.to_metrics('report', current_date - 30, current_date);
