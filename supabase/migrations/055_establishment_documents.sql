-- Migration 055: Add uploaded regulatory document photo URLs to establishments
-- Preserves business permit, PCSSD, and DOT accreditation photos upon operator application approval.

alter table public.establishments
  add column if not exists business_permit_url text,
  add column if not exists pcss_url text,
  add column if not exists dot_accreditation_url text;

-- Grant select, insert, and update on establishments to authenticated TO staff
grant select, insert, update on public.establishments to authenticated;
