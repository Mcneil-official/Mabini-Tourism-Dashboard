-- Migration 054: Add Dive Professional Monitoring and Credentials fields to tourists
-- Enables Tourism Office (TO) staff to monitor, distinguish, and verify Dive Instructors and Divemasters.

alter table public.tourists
  add column if not exists agency text,
  add column if not exists license_number text,
  add column if not exists credentials_url text,
  add column if not exists affiliated_operator text,
  add column if not exists pro_verified boolean default false;

-- Grant select and update to authenticated staff/superadmins
grant select, update on public.tourists to authenticated;
