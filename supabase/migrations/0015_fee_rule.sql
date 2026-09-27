-- Single source of truth for the joining fee: the plan decides, not a guess
-- based on whether it is an add-on. Walk-ins never carry it.
create or replace function public.request_payment(
  p_plan uuid, p_method pay_method, p_reference text default null,
  p_proof text default null, p_branch uuid default null
) returns uuid language plpgsql security definer set search_path to 'public' as $fn$
declare uid uuid := auth.uid(); pl plans; s settings; p profiles; amt numeric; reg boolean; new_id uuid;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select * into pl from plans where id = p_plan and is_active;
  if pl.id is null then raise exception 'plan unavailable'; end if;
  select * into s from settings where id;
  select * into p from profiles where id = uid;
  reg := pl.requires_registration and not p.registration_paid;
  amt := pl.price + case when reg then s.registration_fee else 0 end;
  perform set_config('app.privileged','on',true);
  insert into payments (user_id, plan_id, branch_id, amount, method, status, reference, proof_url, includes_registration)
  values (uid, pl.id, coalesce(p_branch, p.branch_id), amt, p_method, 'pending', p_reference, p_proof, reg)
  returning id into new_id;
  return new_id;
end;$fn$;

create or replace function public.record_payment(
  p_user uuid, p_plan uuid, p_method pay_method,
  p_reference text default null, p_auto_confirm boolean default true
) returns uuid language plpgsql security definer set search_path to 'public' as $fn$
declare actor uuid := auth.uid(); pl plans; s settings; p profiles; amt numeric; reg boolean; new_id uuid;
begin
  if not public.is_staff() then raise exception 'not permitted'; end if;
  select * into pl from plans where id = p_plan and is_active;
  if pl.id is null then raise exception 'plan unavailable'; end if;
  select * into s from settings where id;
  select * into p from profiles where id = p_user;
  if p.id is null then raise exception 'member not found'; end if;
  reg := pl.requires_registration and not p.registration_paid;
  amt := pl.price + case when reg then s.registration_fee else 0 end;
  perform set_config('app.privileged','on',true);
  insert into payments (user_id, plan_id, branch_id, amount, method, status, reference, includes_registration)
  values (p_user, pl.id, coalesce(p.branch_id, (select branch_id from profiles where id = actor)),
          amt, p_method, 'pending', p_reference, reg)
  returning id into new_id;
  insert into audit_log (actor_id, action, entity, entity_id, details)
  values (actor, 'record_payment', 'payments', new_id,
          jsonb_build_object('member', p_user, 'amount', amt, 'method', p_method));
  if p_auto_confirm then perform public.confirm_payment(new_id); end if;
  return new_id;
end;$fn$;

create or replace function public.guard_payment_insert()
returns trigger language plpgsql as $fn$
declare pl plans; s settings; p profiles; reg boolean;
begin
  if public.is_trusted_writer() then return new; end if;
  new.status := 'pending';
  new.confirmed_by := null;
  new.confirmed_at := null;
  if not public.is_staff() then new.user_id := auth.uid(); end if;
  select * into pl from plans where id = new.plan_id;
  if pl.id is null or not pl.is_active then raise exception 'plan unavailable'; end if;
  select * into s from settings where id;
  select * into p from profiles where id = new.user_id;
  reg := pl.requires_registration and not coalesce(p.registration_paid, false);
  new.amount := pl.price + case when reg then s.registration_fee else 0 end;
  new.includes_registration := reg;
  return new;
end;$fn$;
