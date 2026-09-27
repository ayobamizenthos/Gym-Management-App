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
  insert into profiles (id, full_name, phone, username, referred_by, member_code, role)
  values (new.id,
          nullif(trim(new.raw_user_meta_data->>'full_name'),''),
          nullif(trim(new.raw_user_meta_data->>'phone'),''),
          v_username, v_referrer, v_code, 'member');
  if v_referrer is not null then
    insert into referrals (referrer_id, referred_id) values (v_referrer, new.id)
    on conflict (referred_id) do nothing;
  end if;
  return new;
end;$fn$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.claim_username(p_username text)
returns void language plpgsql security definer set search_path to 'public' as $fn$
declare uid uuid := auth.uid(); v text := lower(trim(p_username));
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if v !~ '^[a-z0-9_]{3,20}$' then raise exception 'Username must be 3-20 letters, numbers or underscore'; end if;
  if exists (select 1 from profiles where username = v::citext and id <> uid) then
    raise exception 'That username is taken';
  end if;
  perform set_config('app.privileged','on',true);
  update profiles set username = v::citext where id = uid and username is null;
  if not found then raise exception 'Your username is already set'; end if;
end;$fn$;
grant execute on function public.claim_username(text) to authenticated;

create or replace function public.check_in(p_branch uuid default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $fn$
declare
  uid uuid := auth.uid();
  p   profiles;
  s   settings;
  recent timestamptz;
  k   checkin_kind;
  days int;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select * into p from profiles where id = uid;
  if p.id is null then raise exception 'profile missing'; end if;
  select * into s from settings where id;
  select max(created_at) into recent from check_ins
   where user_id = uid and created_at > now() - make_interval(hours => s.checkin_window_hours);
  if p.expires_at is null then
    k := 'no_membership';
  elsif recent is not null then
    k := 'duplicate';
  elsif p.expires_at >= now() then
    k := 'valid';
  else
    k := 'expired';
  end if;
  perform set_config('app.privileged','on',true);
  insert into check_ins (user_id, branch_id, kind)
  values (uid, coalesce(p_branch, p.branch_id), k);
  days := case when p.expires_at is null then null
               else greatest(0, ceil(extract(epoch from (p.expires_at - now()))/86400)::int) end;
  return jsonb_build_object(
    'kind', k,
    'full_name', p.full_name,
    'member_code', p.member_code,
    'photo_url', p.photo_url,
    'expires_at', p.expires_at,
    'days_left', days,
    'is_active', (p.expires_at is not null and p.expires_at >= now()),
    'last_check_in', recent
  );
end;$fn$;
grant execute on function public.check_in(uuid) to authenticated;
