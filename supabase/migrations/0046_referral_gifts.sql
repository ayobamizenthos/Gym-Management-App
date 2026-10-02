-- Three paid referrals no longer add the free days silently: they wait in a gift
-- the member unwraps by shaking their phone, and opening it adds the days.

create table if not exists public.referral_gifts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  days        integer not null check (days > 0),
  created_at  timestamptz not null default now(),
  opened_at   timestamptz
);
create index if not exists referral_gifts_waiting_idx on public.referral_gifts (user_id) where opened_at is null;
alter table public.referral_gifts enable row level security;
drop policy if exists referral_gifts_own on public.referral_gifts;
create policy referral_gifts_own on public.referral_gifts for select to authenticated using (user_id = auth.uid());
grant select on public.referral_gifts to authenticated;

create or replace function public.open_referral_gift(p_gift uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  gift referral_gifts%rowtype;
begin
  update referral_gifts set opened_at = now()
   where id = p_gift and user_id = auth.uid() and opened_at is null
  returning * into gift;
  if gift.id is null then return 0; end if;
  perform public.grant_days(gift.user_id, gift.days);
  return gift.days;
end;
$$;
revoke execute on function public.open_referral_gift(uuid) from public, anon;
grant execute on function public.open_referral_gift(uuid) to authenticated;

CREATE OR REPLACE FUNCTION public.confirm_payment(p_payment uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  actor uuid := auth.uid();
  pay payments; pl plans; p profiles; s settings;
  new_expiry timestamptz; held integer;
  ref referrals; qualified_count int; short_by int;
  joiner text;
begin
  if not (public.can_confirm_payments()) then
    raise exception 'not permitted';
  end if;
  select * into pay from payments where id = p_payment for update;
  if pay.id is null then raise exception 'payment not found'; end if;
  if pay.status <> 'pending' then raise exception 'payment already handled'; end if;
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role'
     and (pay.method = 'paystack' or not public.staff_covers(pay.branch_id)) then
    raise exception 'not permitted';
  end if;

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

        joiner := coalesce(nullif(trim(p.full_name), ''), 'Someone you invited');

        if qualified_count >= s.referral_target then
          -- the free days wait in a gift the member opens by shaking their phone
          insert into referral_gifts (user_id, days) values (ref.referrer_id, s.referral_reward_days);
          update referrals set rewarded_at = now()
           where referrer_id = ref.referrer_id and qualified_at is not null and rewarded_at is null;
          insert into notifications (user_id, type, title, message)
          values (ref.referrer_id, 'referral_reward',
                  s.referral_reward_days || ' free days are waiting',
                  joiner || ' paid, which makes ' || s.referral_target ||
                  '. Open the app and shake your phone to unwrap your ' || s.referral_reward_days || ' free days.');
        else
          -- the in-between moment: it landed, and here is how close the next one is
          short_by := s.referral_target - qualified_count;
          insert into notifications (user_id, type, title, message)
          values (ref.referrer_id, 'referral_joined',
                  joiner || ' joined on your link',
                  'That is ' || qualified_count || ' of ' || s.referral_target || '. ' ||
                  short_by || ' more and you get ' || s.referral_reward_days || ' free days.');
        end if;
      end if;
    end if;
  end if;

  if not exists (select 1 from payments where user_id = p.id and status = 'confirmed' and id <> pay.id) then
    insert into notifications (user_id, type, title, message)
    select staff.id, 'member_joined', 'New paid member',
           coalesce(nullif(trim(p.full_name), ''), 'A member') || ' joined on ' || coalesce(pl.name, 'a plan') || '.'
      from profiles staff
     where staff.role = 'admin'
        or (staff.role = 'receptionist' and (pay.branch_id is null or staff.branch_id = pay.branch_id));
  end if;

  insert into audit_log (actor_id, action, entity, entity_id, details)
  values (actor, 'confirm_payment', 'payments', pay.id,
          jsonb_build_object('amount', pay.amount, 'method', pay.method));

  select * into p from profiles where id = pay.user_id;
  return jsonb_build_object('ok', true, 'expires_at', p.expires_at, 'pending_days', p.pending_days);
end;$function$;
