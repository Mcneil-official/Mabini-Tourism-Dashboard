-- Migration 056: Complete Diver Profile Checklist & Guiding Accreditations
-- Adds full checklist support: Emergency Contact, Dive Types, PCSSD Accreditation, and Municipal Permit to Operate (PTO)

alter table public.tourists
  add column if not exists emergency_contact_name text,
  add column if not exists emergency_contact_phone text,
  add column if not exists type_of_dive text,
  add column if not exists diver_type text,
  add column if not exists pcssd_number text,
  add column if not exists pcssd_certificate_url text,
  add column if not exists pto_number text,
  add column if not exists pto_url text,
  add column if not exists data_privacy_consent boolean default true;

-- Grant permissions to authenticated users/staff
grant select, update on public.tourists to authenticated;
