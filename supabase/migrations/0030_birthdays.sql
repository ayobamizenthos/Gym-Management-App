-- Birthdays.
--
-- A member who scans in is told, quietly, who on the floor is celebrating today.
-- Not a broadcast at midnight that everyone swipes away - a small card at the
-- moment they walk in, when the person is probably in the room.
--
-- Only members who are actually training are named: someone whose membership
-- lapsed months ago is not "here today", and putting their face up would be
-- worse than saying nothing.

create or replace function public.birthdays_today()
returns table (username text, full_name text, photo_url text)
language sql stable security definer set search_path = public as $$
  select p.username::text, p.full_name, p.photo_url
    from profiles p
   where p.role = 'member'
     and p.date_of_birth is not null
     and to_char(p.date_of_birth, 'MM-DD') = to_char(now(), 'MM-DD')
     and p.expires_at is not null
     and p.expires_at >= now()
     and p.id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
   order by p.username
   limit 5
$$;

grant execute on function public.birthdays_today() to authenticated;

-- The celebrant hears about it too, once, on the day they scan in.
create or replace function public.check_in(p_branch uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare
  uid uuid := auth.uid();
  p profiles; s settings; recent timestamptz; k checkin_kind; days int; b uuid;
  started boolean := false;
  is_birthday boolean := false;
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

  is_birthday := p.date_of_birth is not null
             and to_char(p.date_of_birth, 'MM-DD') = to_char(now(), 'MM-DD');

  -- one greeting per birthday, however many times they scan
  if is_birthday and k = 'valid' and not exists (
    select 1 from notifications
     where user_id = uid and type = 'birthday'
       and created_at > now() - interval '20 hours'
  ) then
    insert into notifications (user_id, type, title, message)
    values (uid, 'birthday', 'Happy birthday',
            'Have a great session today. The floor knows it is your day.');
  end if;

  days := case when p.expires_at is null then null
               else greatest(0, ceil(extract(epoch from (p.expires_at - now()))/86400)::int) end;

  return jsonb_build_object(
    'kind', k, 'full_name', p.full_name, 'username', p.username,
    'photo_url', p.photo_url, 'expires_at', p.expires_at, 'days_left', days,
    'is_active', (p.expires_at is not null and p.expires_at >= now()),
    'last_check_in', recent, 'just_started', started, 'is_birthday', is_birthday
  );
end;$fn$;
