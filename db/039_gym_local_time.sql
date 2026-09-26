-- The door keeps the gym's own clock.
--
-- A repeat scan now means a second valid visit on the same local day rather
-- than within a rolling window, so the 7pm member who returns at 6pm tomorrow
-- is let in. Membership started at the door runs to the end of the local day
-- it lands on, birthdays follow the local date (29 February falls on the 28th
-- in other years), and dates in messages are written in local time.

alter table settings add column if not exists timezone text not null default 'Africa/Lagos';
alter table settings drop constraint if exists settings_timezone_known;
alter table settings add constraint settings_timezone_known check (now() at time zone timezone is not null);

create or replace function public.local_birthday(p_born date, p_tz text)
returns boolean language sql stable set search_path = public as $$
  select case
    when to_char(p_born, 'MM-DD') = '02-29'
     and to_char((date_trunc('year', now() at time zone p_tz) + interval '1 month 28 days')::date, 'MM-DD') = '03-01'
      then to_char(now() at time zone p_tz, 'MM-DD') = '02-28'
    else to_char(p_born, 'MM-DD') = to_char(now() at time zone p_tz, 'MM-DD')
  end
$$;

create or replace function public.check_in(p_branch uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  p profiles; s settings; k checkin_kind; days int; b uuid;
  day_start timestamptz;
  visited_today boolean;
  started boolean := false;
  is_birthday boolean := false;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select * into p from profiles where id = uid for update;
  if p.id is null then raise exception 'profile missing'; end if;
  select * into s from settings where id;

  if (select count(*) from check_ins where user_id = uid and created_at > now() - interval '10 minutes') >= 6 then
    raise exception 'Too many scans. Wait a few minutes.';
  end if;

  select id into b from branches where id = coalesce(p_branch, p.branch_id) and is_active;
  if b is null then select id into b from branches where is_active order by created_at limit 1; end if;

  perform set_config('app.privileged', 'on', true);

  if p.pending_days > 0 and (p.expires_at is null or p.expires_at <= now()) then
    update profiles
       set expires_at = ((now() at time zone s.timezone)::date + p.pending_days + 1)::timestamp at time zone s.timezone,
           pending_days = 0
     where id = uid;
    select * into p from profiles where id = uid;
    started := true;

    insert into notifications (user_id, type, title, message)
    values (uid, 'payment_confirmed', 'Membership started',
            'Your membership is running and ends ' || to_char(p.expires_at at time zone s.timezone, 'DD Mon YYYY') || '.');
  end if;

  day_start := date_trunc('day', now() at time zone s.timezone) at time zone s.timezone;
  visited_today := exists (
    select 1 from check_ins where user_id = uid and kind = 'valid' and created_at >= day_start
  );

  if p.expires_at is null then k := 'no_membership';
  elsif visited_today and not started then k := 'duplicate';
  elsif p.expires_at >= now() then k := 'valid';
  else k := 'expired';
  end if;

  insert into check_ins (user_id, branch_id, kind) values (uid, b, k);

  is_birthday := p.date_of_birth is not null and public.local_birthday(p.date_of_birth, s.timezone);

  if is_birthday and k = 'valid' and not exists (
    select 1 from notifications where user_id = uid and type = 'birthday' and created_at >= day_start
  ) then
    insert into notifications (user_id, type, title, message)
    values (uid, 'birthday', 'Happy birthday', 'Have a great session today.');
  end if;

  days := case when p.expires_at is null then null
               else greatest(0, ceil(extract(epoch from (p.expires_at - now())) / 86400)::int) end;

  return jsonb_build_object(
    'kind', k, 'full_name', p.full_name, 'username', p.username,
    'photo_url', p.photo_url, 'expires_at', p.expires_at, 'days_left', days,
    'is_active', (p.expires_at is not null and p.expires_at >= now()),
    'just_started', started, 'is_birthday', is_birthday
  );
end;
$$;
revoke execute on function public.check_in(uuid) from public, anon;
grant execute on function public.check_in(uuid) to authenticated;

-- Faces on the door screen are only shown to someone standing at that door.
create or replace function public.birthdays_today(p_branch uuid default null)
returns table (username text, full_name text, photo_url text)
language sql stable security definer set search_path = public as $$
  select p.username::text, p.full_name, p.photo_url
    from profiles p, settings s
   where s.id
     and p.role = 'member'
     and p.date_of_birth is not null
     and public.local_birthday(p.date_of_birth, s.timezone)
     and p.expires_at >= now()
     and p.id <> auth.uid()
     and p.branch_id is not distinct from p_branch
     and (public.staff_covers(p_branch) or exists (
       select 1 from check_ins c
        where c.user_id = auth.uid() and c.branch_id is not distinct from p_branch
          and c.created_at > now() - interval '12 hours'
     ))
   order by p.username
   limit 5
$$;
revoke execute on function public.birthdays_today(uuid) from public, anon;
grant execute on function public.birthdays_today(uuid) to authenticated;
