-- 050_eco_dive_ids_updated_at.sql
-- Adds updated_at column to eco_dive_ids to resolve trigger dependency during manifest verification.
-- Fixes error: column "updated_at" of relation "eco_dive_ids" does not exist (42703).
-- Apply in Supabase SQL Editor (service role / postgres). Idempotent.

alter table public.eco_dive_ids
  add column if not exists updated_at timestamptz default now();

comment on column public.eco_dive_ids.updated_at is
  'Timestamp when the eco-dive pass ID status was last updated or verified.';
