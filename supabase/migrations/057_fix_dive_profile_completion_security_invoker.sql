-- Migration 057: Fix Security Definer View on public.dive_profile_completion
-- Resolves Supabase Database Linter / Security Advisor warning: security_definer_view
-- Ensures the view enforces permissions and row-level security (RLS) policies
-- of the querying user (security_invoker) rather than the view creator.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_views 
    WHERE schemaname = 'public' 
      AND viewname = 'dive_profile_completion'
  ) THEN
    EXECUTE 'ALTER VIEW public.dive_profile_completion SET (security_invoker = true);';
  END IF;
END $$;
