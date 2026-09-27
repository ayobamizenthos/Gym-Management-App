-- Members drop proof into their own folder; only staff can read them back.
drop policy if exists proofs_member_upload on storage.objects;
create policy proofs_member_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'proofs' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists proofs_owner_read on storage.objects;
create policy proofs_owner_read on storage.objects for select to authenticated
  using (bucket_id = 'proofs' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff()));
