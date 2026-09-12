-- Every referral that lands is worth hearing about.
--
-- Rewards already repeat: each time three paid referrals stack up, another week
-- is granted, and the counter starts again. What was missing was the moment in
-- between - someone you invited actually paid, and you heard nothing until the
-- third one. Now each confirmed referral announces itself and says how far off
-- the next reward is.

create or replace function public.confirm_payment(p_payment uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $fn$
declare
  actor uuid := auth.uid();
  pay payments; pl plans; p profiles; s settings;
  new_expiry timestamptz; held integer;
  ref referrals; qualified_count int; short_by int;
  joiner text;
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

        joiner := coalesce(nullif(trim(p.full_name), ''), 'Someone you invited');

        if qualified_count >= s.referral_target then
          perform public.grant_days(ref.referrer_id, s.referral_reward_days);
          update referrals set rewarded_at = now()
           where referrer_id = ref.referrer_id and qualified_at is not null and rewarded_at is null;
          insert into notifications (user_id, type, title, message)
          values (ref.referrer_id, 'referral_reward',
                  s.referral_reward_days || ' free days earned',
                  joiner || ' paid, which makes ' || s.referral_target ||
                  '. Your ' || s.referral_reward_days || ' free days are added, and the count starts again.');
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

  insert into audit_log (actor_id, action, entity, entity_id, details)
  values (actor, 'confirm_payment', 'payments', pay.id,
          jsonb_build_object('amount', pay.amount, 'method', pay.method));

  select * into p from profiles where id = pay.user_id;
  return jsonb_build_object('ok', true, 'expires_at', p.expires_at, 'pending_days', p.pending_days);
end;$fn$;
