-- Member photos reach the front desk the moment they change.
--
-- Each upload now gets its own file name so no phone or CDN can keep serving
-- the old picture. The member removes the file it replaced, which needs a
-- delete rule on their own folder, and profile changes are published so an
-- open members list swaps the new face in without a refresh. Realtime applies
-- the same row security as a select, so staff receive members and a member
-- receives only themselves.

drop policy if exists avatars_owner_delete on storage.objects;
create policy avatars_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end $$;
