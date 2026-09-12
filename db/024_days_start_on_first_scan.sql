-- A membership should not burn while its owner is still at home.
--
-- Someone pays on Friday and first shows up on Monday. Starting their clock at
-- the till costs them three days they never used, and the front desk gets the
-- argument. So days bought are held, and the first scan starts them.
--
-- A renewal is different. If the clock is already running, the new days stack on
-- the end of it: paying early must never shorten what is left, and must not
-- park the new days behind a scan the member has clearly already been making.

alter table public.profiles
  add column if not exists pending_days integer not null default 0;

-- pending days are granted by the payment functions, never by the member
create or replace function public.guard_profile()
returns trigger language plpgsql as $fn$
begin
  if public.is_trusted_writer() then return new; end if;

  new.expires_at        := old.expires_at;
  new.pending_days      := old.pending_days;
  new.registration_paid := old.registration_paid;
  new.referred_by       := old.referred_by;
  new.member_code       := old.member_code;
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

-- ---------------------------------------------------------------------------
-- Granting days: extend a running clock, otherwise hold them for the first scan
-- ---------------------------------------------------------------------------
create or replace function public.grant_days(p_user uuid, p_days integer)
returns timestamptz language plpgsql security definer set search_path to 'public' as $fn$
declare running timestamptz; result timestamptz;
begin
  if p_days is null or p_days <= 0 then return null; end if;
  select expires_at into running from profiles where id = p_user for update;

  perform set_config('app.privileged','on',true);
  if running is not null and running > now() then
    result := running + make_interval(days => p_days);
    update profiles set expires_at = result where id = p_user;
    return result;
  end if;

  update profiles set pending_days = pending_days + p_days where id = p_user;
  return null;
end;$fn$;

create or replace function public.confirm_payment(p_payment uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $fn$
declare
  actor uuid := auth.uid();
  pay payments; pl plans; p profiles; s settings;
  new_expiry timestamptz; held integer;
  ref referrals; qualified_count int;
begin
  if not (public.is_staff() or public.is_trusted_writer()) then
    raise exception 'not permitted';
  end if;
  select * into pay from payments where id = p_payment for update;
  if pay.id is null then raise exception 'payment not found'; end if;
  if pay.status <> 'pending' then raise exception 'payment already handled'; end if;

  select * into pl from plans where id = pay.plan_id;
  select * into p  from profiles where id = pay.user_id for update;
  select * into s  from settings where id;

  perform set_config('app.privileged','on',true);
  update payments set status='confirmed', confirmed_by=actor, confirmed_at=now() where id = pay.id;

  if pay.includes_registration then
    update profiles set registration_paid = true where id = p.id;
  end if;

  if pl.id is not null and not pl.is_addon and pl.duration_days > 0 then
    new_expiry := public.grant_days(p.id, pl.duration_days);
    select pending_days into held from profiles where id = p.id;

    insert into memberships (user_id, plan_id, branch_id, starts_at, expires_at)
    values (p.id, pl.id, coalesce(pay.branch_id, p.branch_id),
            coalesce(new_expiry - make_interval(days => pl.duration_days), now()),
            coalesce(new_expiry, now() + make_interval(days => pl.duration_days)));

    insert into notifications (user_id, type, title, message)
    values (p.id, 'payment_confirmed', 'Payment confirmed',
            case when new_expiry is not null
              then pl.name || ' added. Your membership now runs to ' || to_char(new_expiry,'DD Mon YYYY') || '.'
              else pl.name || ' is ready. Your ' || held || ' days start the first time you scan in.'
            end);

    if pl.counts_for_referral and p.referred_by is not null then
      select * into ref from referrals where referred_id = p.id;
      if ref.id is not null and ref.qualified_at is null then
        update referrals set qualified_at = now() where id = ref.id;
        select count(*) into qualified_count from referrals
         where referrer_id = ref.referrer_id and qualified_at is not null and rewarded_at is null;
        if qualified_count >= s.referral_target then
          perform public.grant_days(ref.referrer_id, s.referral_reward_days);
          update referrals set rewarded_at = now()
           where referrer_id = ref.referrer_id and qualified_at is not null and rewarded_at is null;
          insert into notifications (user_id, type, title, message)
          values (ref.referrer_id, 'referral_reward', 'You earned free days',
                  s.referral_reward_days || ' free days are yours. ' ||
                  'They are added to your membership, or start on your next scan if it has ended.');
        end if;
      end if;
    end if;
  end if;

  insert into audit_log (actor_id, action, entity, entity_id, details)
  values (actor, 'confirm_payment', 'payments', pay.id,
          jsonb_build_object('amount', pay.amount, 'method', pay.method));

  select * into p from profiles where id = pay.user_id;
  return jsonb_build_object('ok', true, 'expires_at', p.expires_at, 'pending_days', p.pending_days);
end;$fn$;

-- ---------------------------------------------------------------------------
-- The first scan is what starts the clock
-- ---------------------------------------------------------------------------
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
    'kind', k, 'full_name', p.full_name, 'member_code', p.member_code,
    'photo_url', p.photo_url, 'expires_at', p.expires_at, 'days_left', days,
    'is_active', (p.expires_at is not null and p.expires_at >= now()),
    'last_check_in', recent, 'just_started', started
  );
end;$fn$;

grant execute on function public.grant_days(uuid, integer) to authenticated;
