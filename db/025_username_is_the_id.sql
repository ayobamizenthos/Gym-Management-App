-- The username is the member's identity.
--
-- Every member already had two identifiers: a generated code nobody could say
-- out loud, and a username they chose. Two identifiers for one person is one
-- too many, so the code goes and the username carries the job. It is unique,
-- lowercase in storage because it lives in a URL, and claimed once.
--
-- A taken username is now refused loudly instead of being silently dropped,
-- which is what happened before: you asked for a name, the trigger quietly gave
-- you none, and nothing said why.

create or replace function public.username_available(p_username text)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select lower(trim(p_username)) ~ '^[a-z0-9_]{3,20}$'
     and not exists (select 1 from profiles where username = lower(trim(p_username))::citext)
$$;

grant execute on function public.username_available(text) to anon, authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path to 'public' as $fn$
declare
  v_username text := lower(nullif(trim(new.raw_user_meta_data->>'username'),''));
  v_ref      text := lower(nullif(trim(new.raw_user_meta_data->>'referral'),''));
  v_referrer uuid;
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

  insert into profiles (id, full_name, phone, email, address, username, referred_by, role)
  values (new.id,
          nullif(trim(new.raw_user_meta_data->>'full_name'),''),
          nullif(trim(new.raw_user_meta_data->>'phone'),''),
          lower(new.email),
          nullif(trim(new.raw_user_meta_data->>'address'),''),
          v_username, v_referrer, 'member');

  if v_referrer is not null then
    insert into referrals (referrer_id, referred_id) values (v_referrer, new.id)
    on conflict (referred_id) do nothing;
  end if;
  return new;
end;$fn$;

-- check_in no longer reports a code that does not exist
create or replace function public.check_in(p_branch uuid default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $fn$
declare
  uid uuid := auth.uid();
  p profiles; s settings; recent timestamptz; k checkin_kind; days int; b uuid;
  started boolean := false;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select * into p from profiles where id = uid for update;
  if p.id is null then raise exception 'profile missing'; end if;
  select * into s from settings where id;

  select id into b from branches where id = coalesce(p_branch, p.branch_id) and is_active;
  if b is null then select id into b from branches where is_active order by created_at limit 1; end if;

  perform set_config('app.privileged','on',true);

  -- days bought but never started begin now, on the way through the door
  if p.pending_days > 0 and (p.expires_at is null or p.expires_at <= now()) then
    update profiles
       set expires_at = now() + make_interval(days => p.pending_days),
           pending_days = 0
     where id = uid;
    select * into p from profiles where id = uid;
    started := true;

    insert into notifications (user_id, type, title, message)
    values (uid, 'payment_confirmed', 'Membership started',
            'Your membership is running and ends ' || to_char(p.expires_at,'DD Mon YYYY') || '.');
  end if;

  select max(created_at) into recent from check_ins
   where user_id = uid and created_at > now() - make_interval(hours => s.checkin_window_hours);

  if p.expires_at is null then k := 'no_membership';
  elsif recent is not null and not started then k := 'duplicate';
  elsif p.expires_at >= now() then k := 'valid';
  else k := 'expired';
  end if;

  insert into check_ins (user_id, branch_id, kind) values (uid, b, k);

  days := case when p.expires_at is null then null
               else greatest(0, ceil(extract(epoch from (p.expires_at - now()))/86400)::int) end;

  return jsonb_build_object(
    'kind', k, 'full_name', p.full_name, 'username', p.username,
    'photo_url', p.photo_url, 'expires_at', p.expires_at, 'days_left', days,
    'is_active', (p.expires_at is not null and p.expires_at >= now()),
    'last_check_in', recent, 'just_started', started
  );
end;$fn$;

-- the column guards lose a field that no longer exists
create or replace function public.guard_profile()
returns trigger language plpgsql as $fn$
begin
  if public.is_trusted_writer() then return new; end if;

  new.expires_at        := old.expires_at;
  new.pending_days      := old.pending_days;
  new.registration_paid := old.registration_paid;
  new.referred_by       := old.referred_by;
  new.username          := old.username;
  new.email             := old.email;
  new.created_at        := old.created_at;

  if not public.is_staff() then
    new.full_name     := old.full_name;
    new.date_of_birth := old.date_of_birth;
  end if;

  if not public.is_admin() then
    new.role      := old.role;
    new.branch_id := old.branch_id;
  end if;

  return new;
end;$fn$;

alter table public.profiles drop column if exists member_code;
