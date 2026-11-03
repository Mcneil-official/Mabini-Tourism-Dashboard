-- 049_to_dive_plan_analytics.sql
-- Tourism Office analytics view and RLS policies for tourist dive preferences.
-- Compliant with Republic Act No. 10173 (Data Privacy Act of 2012)
-- Aggregated statistical view protects individual diver identity while
-- providing carrying-capacity and resource allocation insights to the TO.

-- 1. Create aggregated, privacy-safe analytics view for Tourism Office Dashboard
create or replace view public.to_tourism_preference_analytics as
select
  coalesce(preferred_activities, 'Unspecified') as preferred_activities,
  coalesce(length_of_stay, 'Unspecified') as length_of_stay,
  count(*)::integer as total_requests,
  round(avg(coalesce(group_size, 1)), 1) as avg_group_size,
  date_trunc('month', created_at) as request_month
from public.dive_plan_inputs
group by coalesce(preferred_activities, 'Unspecified'), coalesce(length_of_stay, 'Unspecified'), date_trunc('month', created_at);

-- 2. Allow authenticated users (specifically TO staff through views) to read analytics
grant select on public.to_tourism_preference_analytics to authenticated;

-- 3. Policy for TO staff to read dive_plan_inputs when performing municipal audits
drop policy if exists "TO staff read dive plan inputs" on public.dive_plan_inputs;
create policy "TO staff read dive plan inputs"
  on public.dive_plan_inputs for select
  using (public.is_to_staff());

grant select on public.dive_plan_inputs to authenticated;
