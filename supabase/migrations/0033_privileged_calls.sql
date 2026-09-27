-- Closes the ways a member could hand themselves membership time.
--
-- Postgres grants execute on every new function to public, so each security
-- definer function here was callable by anyone holding the publishable key.
-- grant_days took any member and any number of days with no check at all.
-- confirm_payment trusted is_trusted_writer(), which inside a definer function
-- sees current_user as the owner and so passed for every caller.
--
-- Internal helpers lose their public grant entirely; functions that act on the
-- caller's own identity stay open to signed-in users only.

revoke execute on function public.grant_days(uuid, integer) from public, anon, authenticated;
revoke execute on function public.registration_due(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.notify_push() from public, anon, authenticated;
revoke execute on function public.alert_staff_payment() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prosecdef
       and p.proname in ('admin_overview', 'admin_summary', 'birthdays_today', 'check_in',
                         'claim_username', 'confirm_payment', 'mark_notifications_read',
                         'record_payment', 'reject_payment', 'request_payment', 'request_payments')
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;

-- Only staff, or the server settling a verified card payment, may confirm.
create or replace function public.can_confirm_payments()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_staff() or coalesce(auth.jwt() ->> 'role', '') = 'service_role'
$$;
revoke execute on function public.can_confirm_payments() from public, anon, authenticated;

do $$
declare body text;
begin
  select pg_get_functiondef('public.confirm_payment(uuid)'::regprocedure) into body;
  if position('public.is_staff() or public.is_trusted_writer()' in body) = 0 then
    raise exception 'confirm_payment guard not found; review before applying';
  end if;
  execute replace(body, 'public.is_staff() or public.is_trusted_writer()', 'public.can_confirm_payments()');
end $$;

-- A Paystack reference settles one checkout, once.
create table if not exists public.paystack_settlements (
  reference  text primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  amount     bigint not null,
  created_at timestamptz not null default now()
);
alter table public.paystack_settlements enable row level security;
revoke all on public.paystack_settlements from anon, authenticated;
