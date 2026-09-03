-- Public storage bucket for generated PDF receipts, so a "send receipt" link
-- (WhatsApp text / email body) can point at a real hosted file. Filenames
-- are random UUIDs, so the bucket doesn't need to be listable to be safe —
-- only someone with the exact link can reach a given receipt.
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', true)
on conflict (id) do nothing;

-- Any signed-in session (including the shared Counter account) can upload a
-- receipt PDF at checkout — same wide-open pattern as the other operational
-- tables (see CLAUDE.md's RLS model).
create policy "authenticated_upload_receipts" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'receipts');

-- Public read so a customer can open the link without being signed into the app.
create policy "public_read_receipts" on storage.objects
  for select to public
  using (bucket_id = 'receipts');
