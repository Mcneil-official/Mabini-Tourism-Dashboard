-- Migration 059: Update Dive Plan Preferences Analytics
-- Aligns with Sinsay AI Dive Plan Generator updated form inputs:
-- 1. Budget (PHP): Numeric
-- 2. Group Size: Integer
-- 3. Activities: 8 Canonical options
-- 4. Length of Stay: 6 Canonical options

-- Drop the old view first to allow column reordering / new columns without 42P16 error
drop view if exists public.to_tourism_preference_analytics cascade;

-- Recreate aggregated analytics view for Tourism Office Dashboard with security_invoker
create view public.to_tourism_preference_analytics
with (security_invoker = true) as
select
  coalesce(preferred_activities, 'Unspecified') as preferred_activities,
  coalesce(length_of_stay, 'Unspecified') as length_of_stay,
  count(*)::integer as total_requests,
  round(avg(coalesce(group_size, 1)), 1) as avg_group_size,
  round(avg(
    case
      when budget ~ '^[0-9]+(\.[0-9]+)?$' then budget::numeric
      else null
    end
  ), 2) as avg_budget_php,
  date_trunc('month', created_at) as request_month
from public.dive_plan_inputs
group by
  coalesce(preferred_activities, 'Unspecified'),
  coalesce(length_of_stay, 'Unspecified'),
  date_trunc('month', created_at);

grant select on public.to_tourism_preference_analytics to authenticated;
