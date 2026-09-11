-- Staff records a payment taken at the desk. Amount is always re-derived from
-- the plan and the registration rule, never accepted from the caller.
create or replace function public.record_payment(
  p_user uuid,
  p_plan uuid,
  p_method pay_method,
  p_reference text default null,
  p_auto_confirm boolean default true
) returns uuid language plpgsql security definer set search_path to 'public' as $fn$
declare
  actor uuid := auth.uid();
  pl plans; s settings; p profiles; amt numeric; reg boolean := false; new_id uuid;
begin
  if not public.is_staff() then raise exception 'not permitted'; end if;
  select * into pl from plans where id = p_plan and is_active;
  if pl.id is null then raise exception 'plan unavailable'; end if;
  select * into s from settings where id;
  select * into p from profiles where id = p_user;
  if p.id is null then raise exception 'member not found'; end if;

  amt := pl.price;
  if not p.registration_paid and not pl.is_addon then
    amt := amt + s.registration_fee;
    reg := true;
  end if;

  perform set_config('app.privileged','on',true);
  insert into payments (user_id, plan_id, branch_id, amount, method, status, reference, includes_registration)
  values (p_user, pl.id, coalesce(p.branch_id, (select branch_id from profiles where id = actor)),
          amt, p_method, 'pending', p_reference, reg)
  returning id into new_id;

  insert into audit_log (actor_id, action, entity, entity_id, details)
  values (actor, 'record_payment', 'payments', new_id,
          jsonb_build_object('member', p_user, 'amount', amt, 'method', p_method));

  if p_auto_confirm then
    perform public.confirm_payment(new_id);
  end if;
  return new_id;
end;$fn$;
grant execute on function public.record_payment(uuid, uuid, pay_method, text, boolean) to authenticated;

-- Dashboard rollups, computed server side so the client cannot mis-state money.
create or replace function public.admin_overview(p_days integer default 30)
returns jsonb language plpgsql security definer set search_path to 'public' as $fn$
declare s settings; res jsonb;
begin
  if not public.is_staff() then raise exception 'not permitted'; end if;
  select * into s from settings where id;
  select jsonb_build_object(
    'revenue', (select coalesce(sum(amount),0) from payments
                 where status='confirmed' and created_at > now() - make_interval(days => p_days)),
    'revenue_all', (select coalesce(sum(amount),0) from payments where status='confirmed'),
    'members_total',  (select count(*) from profiles where role='member'),
    'members_active', (select count(*) from profiles where role='member' and expires_at >= now()),
    'members_expired',(select count(*) from profiles where role='member' and expires_at < now()),
    'joined_period',  (select count(*) from profiles where role='member' and created_at > now() - make_interval(days => p_days)),
    'renewals_due',   (select count(*) from profiles where role='member'
                        and expires_at >= now() and expires_at <= now() + make_interval(days => s.expiry_notice_days)),
    'visits_today',   (select count(*) from check_ins where created_at::date = now()::date),
    'pending_payments',(select count(*) from payments where status='pending'),
    'referrals_rewarded',(select count(*) from referrals where rewarded_at is not null)
  ) into res;
  return res;
end;$fn$;
grant execute on function public.admin_overview(integer) to authenticated;
