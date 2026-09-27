-- Money may only enter through request_payment / record_payment, both of which
-- re-derive the amount from the plan and force status = pending. Direct inserts
-- let a client dictate status and amount, so the verb is removed entirely.
drop policy if exists payments_insert on public.payments;
revoke insert on public.payments from authenticated;

-- Defence in depth: even if INSERT is ever granted again, an untrusted caller
-- cannot choose the status, the amount, or whose payment it is.
create or replace function public.guard_payment_insert()
returns trigger language plpgsql as $fn$
declare pl plans; s settings; p profiles;
begin
  if public.is_trusted_writer() then return new; end if;
  new.status := 'pending';
  new.confirmed_by := null;
  new.confirmed_at := null;
  if not public.is_staff() then
    new.user_id := auth.uid();
  end if;
  select * into pl from plans where id = new.plan_id;
  if pl.id is null or not pl.is_active then raise exception 'plan unavailable'; end if;
  select * into s from settings where id;
  select * into p from profiles where id = new.user_id;
  new.amount := pl.price
              + case when (not coalesce(p.registration_paid,false)) and not pl.is_addon
                     then s.registration_fee else 0 end;
  new.includes_registration := (not coalesce(p.registration_paid,false)) and not pl.is_addon;
  return new;
end;$fn$;

drop trigger if exists guard_payment_insert_trg on public.payments;
create trigger guard_payment_insert_trg before insert on public.payments
  for each row execute function public.guard_payment_insert();
