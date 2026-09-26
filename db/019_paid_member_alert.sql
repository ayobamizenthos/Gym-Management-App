-- Staff hear about a member the first time money actually lands, not when an
-- account is created. Everything else about confirmation is unchanged.
create or replace function public.confirm_payment(p_payment uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $fn$
declare
  actor uuid := auth.uid();
  pay payments; pl plans; p profiles; s settings;
  base timestamptz; new_expiry timestamptz;
  ref referrals; qualified_count int; referrer_expiry timestamptz;
  prior_paid int; staff uuid;
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

  -- counted before this row flips, so a first payment reads as zero
  select count(*) into prior_paid
    from payments where user_id = pay.user_id and status = 'confirmed';

  perform set_config('app.privileged','on',true);
  update payments set status='confirmed', confirmed_by=actor, confirmed_at=now() where id = pay.id;

  if pay.includes_registration then
    update profiles set registration_paid = true where id = p.id;
  end if;

  if pl.id is not null and not pl.is_addon and pl.duration_days > 0 then
    base := greatest(now(), coalesce(p.expires_at, now()));
    new_expiry := base + make_interval(days => pl.duration_days);
    update profiles set expires_at = new_expiry where id = p.id;

    insert into memberships (user_id, plan_id, branch_id, starts_at, expires_at)
    values (p.id, pl.id, coalesce(pay.branch_id, p.branch_id), base, new_expiry);

    insert into notifications (user_id, type, title, message)
    values (p.id, 'payment_confirmed', 'Payment confirmed',
            pl.name || ' activated. Your membership now runs to ' || to_char(new_expiry,'DD Mon YYYY') || '.');

    if prior_paid = 0 then
      for staff in select id from profiles where role in ('admin','receptionist') loop
        insert into notifications (user_id, type, title, message)
        values (staff, 'member_joined', 'New paid member',
                coalesce(p.full_name, 'A member') || ' joined on ' || pl.name || '.');
      end loop;
    end if;

    if pl.counts_for_referral and p.referred_by is not null then
      select * into ref from referrals where referred_id = p.id;
      if ref.id is not null and ref.qualified_at is null then
        update referrals set qualified_at = now() where id = ref.id;
        select count(*) into qualified_count from referrals
         where referrer_id = ref.referrer_id and qualified_at is not null and rewarded_at is null;
        if qualified_count >= s.referral_target then
          select expires_at into referrer_expiry from profiles where id = ref.referrer_id for update;
          update profiles
             set expires_at = greatest(now(), coalesce(referrer_expiry, now()))
                              + make_interval(days => s.referral_reward_days)
           where id = ref.referrer_id;
          update referrals set rewarded_at = now()
           where referrer_id = ref.referrer_id and qualified_at is not null and rewarded_at is null;
          insert into notifications (user_id, type, title, message)
          values (ref.referrer_id, 'referral_reward', 'Referral reward unlocked',
                  s.referral_reward_days || ' free days added to your membership.');
        end if;
      end if;
    end if;
  end if;

  insert into audit_log (actor_id, action, entity, entity_id, details)
  values (actor, 'confirm_payment', 'payments', pay.id,
          jsonb_build_object('amount', pay.amount, 'method', pay.method));
  return jsonb_build_object('ok', true, 'expires_at', coalesce(new_expiry, p.expires_at));
end;$fn$;
