-- Migration 058: Cleanup Unused & Redundant Columns on public.tourists
-- Consolidates diver profile guiding accreditations into the active Sinsay columns:
-- - pcssd_accreditation_no & pcssd_url
-- - permit_to_operate_no & permit_to_operate_url
-- - emergency_contact_number & emergency_contact_name
-- - certification_level & type_of_dive
-- And safely drops legacy/unused international agency & C-card columns.

-- 1. Safe consolidation: preserve any data from redundant columns before dropping
UPDATE public.tourists
SET
  pcssd_accreditation_no = COALESCE(pcssd_accreditation_no, pcssd_number),
  pcssd_url = COALESCE(pcssd_url, pcssd_certificate_url),
  permit_to_operate_no = COALESCE(permit_to_operate_no, pto_number),
  permit_to_operate_url = COALESCE(permit_to_operate_url, pto_url),
  emergency_contact_number = COALESCE(emergency_contact_number, emergency_contact_phone),
  certification_level = COALESCE(certification_level, diver_type)
WHERE
  pcssd_number IS NOT NULL OR
  pcssd_certificate_url IS NOT NULL OR
  pto_number IS NOT NULL OR
  pto_url IS NOT NULL OR
  emergency_contact_phone IS NOT NULL OR
  diver_type IS NOT NULL;

-- 2. Drop redundant and unused legacy columns
ALTER TABLE public.tourists
  DROP COLUMN IF EXISTS agency,
  DROP COLUMN IF EXISTS license_number,
  DROP COLUMN IF EXISTS credentials_url,
  DROP COLUMN IF EXISTS pcssd_number,
  DROP COLUMN IF EXISTS pcssd_certificate_url,
  DROP COLUMN IF EXISTS pto_number,
  DROP COLUMN IF EXISTS pto_url,
  DROP COLUMN IF EXISTS emergency_contact_phone,
  DROP COLUMN IF EXISTS diver_type,
  DROP COLUMN IF EXISTS business_permit_url,
  DROP COLUMN IF EXISTS pcss_url;
