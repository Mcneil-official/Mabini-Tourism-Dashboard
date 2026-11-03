-- ============================================
-- SINSAY Migration — Dive Plan Inputs (analytics)
-- Stores tourist preferences for TO dashboard aggregation
-- ============================================

create table if not exists public.dive_plan_inputs (
  id uuid default gen_random_uuid() primary key,
  tourist_id uuid not null references public.tourists(id) on delete cascade,
  budget text,
  group_size integer,
  preferred_activities text,
  length_of_stay text,
  created_at timestamptz default now()
);

alter table public.dive_plan_inputs enable row level security;

create policy "Insert own dive plan inputs"
  on public.dive_plan_inputs for insert
  with check (auth.uid() = tourist_id);

create policy "Read own dive plan inputs"
  on public.dive_plan_inputs for select
  using (auth.uid() = tourist_id);
