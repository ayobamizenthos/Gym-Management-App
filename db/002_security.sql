-- Role helpers. SECURITY DEFINER so policies can read profiles without
-- recursing back through the policies on profiles itself.
create or replace function public.current_role_of()
returns member_role language sql stable security definer set search_path to 'public' as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path to 'public' as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path to 'public' as $$
  select coalesce((select role in ('admin','receptionist') from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.is_trusted_writer()
returns boolean language sql stable as $$
  select current_user in ('service_role','postgres','supabase_admin','supabase_auth_admin')
      or current_setting('app.privileged', true) = 'on'
$$;

-- ---------- column guards: clients can never move money, expiry or role ----------
create or replace function public.guard_profile()
returns trigger language plpgsql as $fn$
begin
  if public.is_trusted_writer() then return new; end if;
  new.expires_at        := old.expires_at;
  new.registration_paid := old.registration_paid;
  new.referred_by       := old.referred_by;
  new.member_code       := old.member_code;
  new.username          := old.username;
  if not public.is_admin() then
    new.role      := old.role;
    new.branch_id := old.branch_id;
  end if;
  return new;
end;$fn$;
create trigger guard_profile_trg before update on public.profiles
  for each row execute function public.guard_profile();

create or replace function public.guard_payment()
returns trigger language plpgsql as $fn$
begin
  if public.is_trusted_writer() then return new; end if;
  new.amount       := old.amount;
  new.status       := old.status;
  new.plan_id      := old.plan_id;
  new.user_id      := old.user_id;
  new.confirmed_by := old.confirmed_by;
  new.confirmed_at := old.confirmed_at;
  new.includes_registration := old.includes_registration;
  return new;
end;$fn$;
create trigger guard_payment_trg before update on public.payments
  for each row execute function public.guard_payment();

-- ---------- RLS ----------
alter table branches      enable row level security;
alter table plans         enable row level security;
alter table profiles      enable row level security;
alter table memberships   enable row level security;
alter table payments      enable row level security;
alter table check_ins     enable row level security;
alter table referrals     enable row level security;
alter table notifications enable row level security;
alter table settings      enable row level security;
alter table audit_log     enable row level security;

create policy branches_read   on branches for select to authenticated using (true);
create policy branches_admin  on branches for all    to authenticated using (public.is_admin()) with check (public.is_admin());

create policy plans_read      on plans for select to authenticated using (is_active or public.is_staff());
create policy plans_admin     on plans for all    to authenticated using (public.is_admin()) with check (public.is_admin());

create policy profiles_self   on profiles for select to authenticated using (id = auth.uid() or public.is_staff());
create policy profiles_update on profiles for update to authenticated using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

create policy memberships_read on memberships for select to authenticated using (user_id = auth.uid() or public.is_staff());

create policy payments_read   on payments for select to authenticated using (user_id = auth.uid() or public.is_staff());
-- a member may only file their OWN pending payment; amount/status are re-derived server side
create policy payments_insert on payments for insert to authenticated with check (user_id = auth.uid() or public.is_staff());

create policy checkins_read   on check_ins for select to authenticated using (user_id = auth.uid() or public.is_staff());

create policy referrals_read  on referrals for select to authenticated using (referrer_id = auth.uid() or referred_id = auth.uid() or public.is_staff());

create policy notif_own       on notifications for select to authenticated using (user_id = auth.uid());
create policy notif_own_upd   on notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy settings_read   on settings for select to authenticated using (true);
create policy settings_admin  on settings for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy audit_admin     on audit_log for select to authenticated using (public.is_admin());
-- no write policies anywhere for audit_log / check_ins / memberships / referrals:
-- only SECURITY DEFINER functions (table owner) insert into them.
