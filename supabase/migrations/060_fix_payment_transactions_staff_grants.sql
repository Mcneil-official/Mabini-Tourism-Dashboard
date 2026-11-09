-- Migration 060: Fix Table Grants and RLS Policies for Payment Transactions & Verification Queues
-- Resolves Postgres error 42501 (permission denied for table payment_transactions)
-- Run in Supabase SQL Editor (service_role / postgres)

-- 1. Ensure columns required by TO verification exist
alter table public.payment_transactions
  add column if not exists rejection_reason text;

-- 2. Grant table-level privileges to authenticated users (evaluated before RLS)
grant select, update on public.payment_transactions to authenticated;
grant all on public.payment_transactions to service_role;

-- 3. Enable RLS on payment_transactions
alter table public.payment_transactions enable row level security;

-- 4. Drop-guard and recreate SELECT policy for staff
drop policy if exists "Staff can view all payment transactions" on public.payment_transactions;
create policy "Staff can view all payment transactions"
  on public.payment_transactions for select
  using (public.is_to_staff());

-- 5. Drop-guard and recreate UPDATE policy for staff
drop policy if exists "Staff can update payment transactions" on public.payment_transactions;
create policy "Staff can update payment transactions"
  on public.payment_transactions for update
  using (public.is_to_staff())
  with check (public.is_to_staff());

-- 6. Also ensure operator_applications, dive_manifests, and tourists have UPDATE grants
grant select, update on public.operator_applications to authenticated;
grant select, update on public.dive_manifests to authenticated;
grant select, update on public.tourists to authenticated;
