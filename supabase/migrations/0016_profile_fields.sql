alter table public.profiles
  add column if not exists address text,
  add column if not exists email text,
  add column if not exists date_of_birth date,
  add column if not exists emergency_contact text;

-- Keep the member's email visible in the profile without a join to auth.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path to 'public' as $fn$
declare
  v_username text := lower(nullif(trim(new.raw_user_meta_data->>'username'),''));
  v_ref      text := lower(nullif(trim(new.raw_user_meta_data->>'referral'),''));
  v_referrer uuid;
  v_code     text;
begin
  if v_username is not null and v_username !~ '^[a-z0-9_]{3,20}$' then v_username := null; end if;
  if v_username is not null and exists (select 1 from profiles where username = v_username::citext) then
    v_username := null;
  end if;
  if v_ref is not null then
    select id into v_referrer from profiles where username = v_ref::citext;
  end if;
  loop
    v_code := 'ZG-' || lpad((floor(random()*1000000))::int::text, 6, '0');
    exit when not exists (select 1 from profiles where member_code = v_code);
  end loop;
  insert into profiles (id, full_name, phone, email, address, username, referred_by, member_code, role)
  values (new.id,
          nullif(trim(new.raw_user_meta_data->>'full_name'),''),
          nullif(trim(new.raw_user_meta_data->>'phone'),''),
          lower(new.email),
          nullif(trim(new.raw_user_meta_data->>'address'),''),
          v_username, v_referrer, v_code, 'member');
  if v_referrer is not null then
    insert into referrals (referrer_id, referred_id) values (v_referrer, new.id)
    on conflict (referred_id) do nothing;
  end if;
  return new;
end;$fn$;

-- Backfill emails for anyone already created.
update profiles p set email = lower(u.email)
  from auth.users u where u.id = p.id and p.email is null;

-- Members own their avatar folder; staff may view for identification.
drop policy if exists avatars_owner_write on storage.objects;
create policy avatars_owner_write on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists avatars_owner_update on storage.objects;
create policy avatars_owner_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists avatars_read on storage.objects;
create policy avatars_read on storage.objects for select to authenticated
  using (bucket_id = 'avatars');
