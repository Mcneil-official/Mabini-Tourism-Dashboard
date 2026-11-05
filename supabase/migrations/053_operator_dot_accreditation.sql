-- Migration 053: Add DOT accreditation document URL to operator_applications
-- Enables Tourism Office (TO) staff and admins to verify Department of Tourism credentials.

alter table public.operator_applications
add column if not exists dot_accreditation_url text;

-- Ensure authenticated TO staff and superadmins can view and update the column
grant select, update on public.operator_applications to authenticated;
