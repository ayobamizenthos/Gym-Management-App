-- Members pick their branch when they sign up, so they appear under it in the
-- desk and admin member lists. Branches are named for where they are.

update branches set address = 'Ijaiye, Lagos' where name = 'Main Branch';
update branches set address = 'Yaba, Lagos' where name = 'Akoka';
insert into branches (name, address, is_active)
select 'Gbagada', 'Charley Boy, Lagos', true
 where not exists (select 1 from branches where name = 'Gbagada');

-- the sign-up page lists open branches before anyone has an account
drop policy if exists branches_read_open on branches;
create policy branches_read_open on branches for select to anon using (is_active);

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_username text := lower(nullif(trim(new.raw_user_meta_data->>'username'),''));
  v_ref      text := lower(nullif(trim(new.raw_user_meta_data->>'referral'),''));
  v_referrer uuid;
  v_branch   uuid;
begin
  if v_username is not null then
    if v_username !~ '^[a-z0-9_]{3,20}$' then
      raise exception 'Username must be 3-20 letters, numbers or underscore';
    end if;
    if exists (select 1 from profiles where username = v_username::citext) then
      raise exception 'Username already exists';
    end if;
  end if;

  if v_ref is not null then
    select id into v_referrer from profiles where username = v_ref::citext;
  end if;

  -- the branch picked at sign-up, if it is a real, open branch
  select id into v_branch from branches
   where is_active and id::text = nullif(trim(new.raw_user_meta_data->>'branch_id'), '');

  insert into profiles (id, full_name, phone, email, address, username, referred_by, role, branch_id)
  values (new.id,
          nullif(trim(new.raw_user_meta_data->>'full_name'),''),
          nullif(trim(new.raw_user_meta_data->>'phone'),''),
          lower(new.email),
          nullif(trim(new.raw_user_meta_data->>'address'),''),
          v_username, v_referrer, 'member', v_branch);

  if v_referrer is not null then
    insert into referrals (referrer_id, referred_id) values (v_referrer, new.id)
    on conflict (referred_id) do nothing;
  end if;
  return new;
end;$function$;
