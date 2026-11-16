-- 062_payment_config_management.sql
-- Enables TO staff / superadmins to manage GCash payment account and QR code.

-- 1. Ensure public bucket 'payment-assets' exists for QR code images
insert into storage.buckets (id, name, public)
values ('payment-assets', 'payment-assets', true)
on conflict (id) do nothing;

drop policy if exists "Anyone can read payment assets" on storage.objects;
create policy "Anyone can read payment assets"
  on storage.objects for select
  using (bucket_id = 'payment-assets');

drop policy if exists "Staff can upload payment assets" on storage.objects;
create policy "Staff can upload payment assets"
  on storage.objects for insert
  with check (bucket_id = 'payment-assets' and (public.is_to_superadmin() or public.is_to_staff()));

drop policy if exists "Staff can update payment assets" on storage.objects;
create policy "Staff can update payment assets"
  on storage.objects for update
  using (bucket_id = 'payment-assets' and (public.is_to_superadmin() or public.is_to_staff()));

-- 2. Ensure RLS policies on public.payment_config allow staff / superadmin writes
drop policy if exists "Staff can insert payment config" on public.payment_config;
create policy "Staff can insert payment config"
  on public.payment_config for insert
  with check (public.is_to_superadmin() or public.is_to_staff());

drop policy if exists "Staff can update payment config" on public.payment_config;
create policy "Staff can update payment config"
  on public.payment_config for update
  using (public.is_to_superadmin() or public.is_to_staff());

grant select, insert, update on public.payment_config to authenticated;

-- 3. Ensure a default payment_config row exists if empty
insert into public.payment_config (account_name, account_number, qr_code_url)
select 'Mabini Tourism Office', '0917-000-0000', null
where not exists (select 1 from public.payment_config);
