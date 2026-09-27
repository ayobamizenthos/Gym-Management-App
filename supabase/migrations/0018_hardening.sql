-- Hardening pass.
--
-- 1. Staff are told about paying members, not sign-ups. A registration with no
--    payment behind it is noise at the front desk.
-- 2. A member may not rewrite the email shown to staff.
-- 3. Multi-plan checkout becomes one transaction instead of a client-side loop.
-- 4. Check-in can no longer be attributed to a branch that does not exist.
-- 5. Indexes for the queries the dashboards actually run.

-- ---------- 1. no alert on mere signup ----------
drop trigger if exists alert_staff_new_member_trg on public.profiles;
drop function if exists public.alert_staff_new_member();

-- ---------- 2. freeze identity columns ----------
create or replace function public.guard_profile()
returns trigger language plpgsql as $fn$
begin
  if public.is_trusted_writer() then return new; end if;
  new.expires_at        := old.expires_at;
  new.registration_paid := old.registration_paid;
  new.referred_by       := old.referred_by;
  new.member_code       := old.member_code;
  new.username          := old.username;
  new.email             := old.email;
  new.created_at        := old.created_at;
  if not public.is_admin() then
    new.role      := old.role;
    new.branch_id := old.branch_id;
  end if;
  return new;
end;$fn$;

-- ---------- 3. atomic multi-plan checkout ----------
create or replace function public.request_payments(
  p_plans uuid[],
  p_method pay_method,
  p_proof text default null,
  p_branch uuid default null
) returns uuid[] language plpgsql security definer set search_path to 'public' as $fn$
declare
  uid uuid := auth.uid();
  s settings; p profiles; pl plans;
  plan_id uuid; amt numeric; reg boolean; new_id uuid;
  ids uuid[] := '{}';
  membership_count int := 0;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if p_plans is null or array_length(p_plans, 1) is null then raise exception 'no plan selected'; end if;
  if array_length(p_plans, 1) > 6 then raise exception 'too many items'; end if;

  select * into s from settings where id;
  select * into p from profiles where id = uid for update;

  -- exactly one membership plan per checkout; the rest must be add-ons
  select count(*) into membership_count
    from plans where id = any(p_plans) and is_active and not is_addon;
  if membership_count <> 1 then raise exception 'select one membership plan'; end if;

  perform set_config('app.privileged','on',true);

  foreach plan_id in array p_plans loop
    select * into pl from plans where id = plan_id and is_active;
    if pl.id is null then raise exception 'plan unavailable'; end if;
    -- the joining fee attaches once, to the membership plan only
    reg := pl.requires_registration and not p.registration_paid;
    amt := pl.price + case when reg then s.registration_fee else 0 end;
    insert into payments (user_id, plan_id, branch_id, amount, method, status, proof_url, includes_registration)
    values (uid, pl.id, coalesce(p_branch, p.branch_id), amt, p_method, 'pending', p_proof, reg)
    returning id into new_id;
    ids := ids || new_id;
    if reg then
      -- later rows in this same checkout must not be charged it again
      p.registration_paid := true;
    end if;
  end loop;

  return ids;
end;$fn$;
grant execute on function public.request_payments(uuid[], pay_method, text, uuid) to authenticated;

-- ---------- 4. check-in must name a real branch ----------
create or replace function public.check_in(p_branch uuid default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $fn$
declare
  uid uuid := auth.uid();
  p profiles; s settings; recent timestamptz; k checkin_kind; days int; b uuid;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select * into p from profiles where id = uid;
  if p.id is null then raise exception 'profile missing'; end if;
  select * into s from settings where id;

  select id into b from branches where id = coalesce(p_branch, p.branch_id) and is_active;
  if b is null then select id into b from branches where is_active order by created_at limit 1; end if;

  select max(created_at) into recent from check_ins
   where user_id = uid and created_at > now() - make_interval(hours => s.checkin_window_hours);

  if p.expires_at is null then k := 'no_membership';
  elsif recent is not null then k := 'duplicate';
  elsif p.expires_at >= now() then k := 'valid';
  else k := 'expired';
  end if;

  perform set_config('app.privileged','on',true);
  insert into check_ins (user_id, branch_id, kind) values (uid, b, k);

  days := case when p.expires_at is null then null
               else greatest(0, ceil(extract(epoch from (p.expires_at - now()))/86400)::int) end;

  return jsonb_build_object(
    'kind', k, 'full_name', p.full_name, 'member_code', p.member_code,
    'photo_url', p.photo_url, 'expires_at', p.expires_at, 'days_left', days,
    'is_active', (p.expires_at is not null and p.expires_at >= now()),
    'last_check_in', recent
  );
end;$fn$;

-- ---------- 5. indexes the dashboards rely on ----------
create index if not exists profiles_expiry_idx on public.profiles(expires_at) where role = 'member';
create index if not exists profiles_role_idx on public.profiles(role);
create index if not exists payments_pending_idx on public.payments(created_at desc) where status = 'pending';
