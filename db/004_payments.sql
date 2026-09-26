create or replace function public.confirm_payment(p_payment uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $fn$
declare
  actor uuid := auth.uid();
  pay   payments;
  pl    plans;
  p     profiles;
  s     settings;
  base  timestamptz;
  new_expiry timestamptz;
  ref   referrals;
  qualified_count int;
  referrer_expiry timestamptz;
begin
  if not public.is_staff() then raise exception 'not permitted'; end if;
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
    base := greatest(now(), coalesce(p.expires_at, now()));
    new_expiry := base + make_interval(days => pl.duration_days);
    update profiles set expires_at = new_expiry where id = p.id;

    insert into memberships (user_id, plan_id, branch_id, starts_at, expires_at)
    values (p.id, pl.id, coalesce(pay.branch_id, p.branch_id), base, new_expiry);

    insert into notifications (user_id, type, title, message)
    values (p.id, 'payment_confirmed', 'Payment confirmed',
            pl.name || ' activated. Your membership now runs to ' || to_char(new_expiry,'DD Mon YYYY') || '.');

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
                  s.referral_reward_days || ' free days added to your membership. Keep inviting.');
        end if;
      end if;
    end if;
  end if;

  insert into audit_log (actor_id, action, entity, entity_id, details)
  values (actor, 'confirm_payment', 'payments', pay.id,
          jsonb_build_object('amount', pay.amount, 'method', pay.method));
  return jsonb_build_object('ok', true, 'expires_at', coalesce(new_expiry, p.expires_at));
end;$fn$;
grant execute on function public.confirm_payment(uuid) to authenticated;

create or replace function public.reject_payment(p_payment uuid, p_reason text default null)
returns void language plpgsql security definer set search_path to 'public' as $fn$
declare actor uuid := auth.uid(); pay payments;
begin
  if not public.is_staff() then raise exception 'not permitted'; end if;
  select * into pay from payments where id = p_payment for update;
  if pay.status <> 'pending' then raise exception 'payment already handled'; end if;
  perform set_config('app.privileged','on',true);
  update payments set status='rejected', confirmed_by=actor, confirmed_at=now() where id = pay.id;
  insert into notifications (user_id, type, title, message)
  values (pay.user_id, 'payment_rejected', 'Payment could not be verified',
          coalesce(p_reason, 'Please contact the front desk.'));
  insert into audit_log (actor_id, action, entity, entity_id, details)
  values (actor, 'reject_payment', 'payments', pay.id, jsonb_build_object('reason', p_reason));
end;$fn$;
grant execute on function public.reject_payment(uuid, text) to authenticated;

-- Members file their own payment request; amount and plan are re-derived here
-- so a tampered client cannot buy a year for one naira.
create or replace function public.request_payment(p_plan uuid, p_method pay_method, p_reference text default null, p_proof text default null, p_branch uuid default null)
returns uuid language plpgsql security definer set search_path to 'public' as $fn$
declare uid uuid := auth.uid(); pl plans; s settings; p profiles; amt numeric; reg boolean := false; new_id uuid;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select * into pl from plans where id = p_plan and is_active;
  if pl.id is null then raise exception 'plan unavailable'; end if;
  select * into s from settings where id;
  select * into p from profiles where id = uid;
  amt := pl.price;
  if not p.registration_paid and not pl.is_addon then
    amt := amt + s.registration_fee;
    reg := true;
  end if;
  perform set_config('app.privileged','on',true);
  insert into payments (user_id, plan_id, branch_id, amount, method, status, reference, proof_url, includes_registration)
  values (uid, pl.id, coalesce(p_branch, p.branch_id), amt, p_method, 'pending', p_reference, p_proof, reg)
  returning id into new_id;
  return new_id;
end;$fn$;
grant execute on function public.request_payment(uuid, pay_method, text, text, uuid) to authenticated;
