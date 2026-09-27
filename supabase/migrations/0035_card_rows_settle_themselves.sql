-- Card payments are settled by the server from Paystack's own record, never by
-- a person. A pending card row only means a checkout was opened, so the desk
-- must neither see it as money to confirm nor be able to confirm it, and a
-- member who closes the card window withdraws it.

do $$
declare body text;
  covered constant text := 'if coalesce(auth.jwt() ->> ''role'', '''') <> ''service_role'' and not public.staff_covers(pay.branch_id) then';
begin
  select pg_get_functiondef('public.confirm_payment(uuid)'::regprocedure) into body;
  if position(covered in body) = 0 then raise exception 'confirm_payment changed; review before applying'; end if;
  execute replace(body, covered,
    'if coalesce(auth.jwt() ->> ''role'', '''') <> ''service_role''' || E'\n' ||
    '     and (pay.method = ''paystack'' or not public.staff_covers(pay.branch_id)) then');
end $$;

create or replace function public.alert_staff_payment()
returns trigger language plpgsql security definer set search_path = public as $$
declare who text;
begin
  if new.status <> 'pending' or new.method = 'paystack' then return new; end if;
  select coalesce(full_name, 'A member') into who from profiles where id = new.user_id;
  insert into notifications (user_id, type, title, message)
  select staff.id, 'payment_pending', 'Payment to confirm',
         who || ' sent ' || to_char(new.amount, 'FM999,999,999') || ' naira for confirmation.'
    from profiles staff
   where staff.role = 'admin'
      or (staff.role = 'receptionist' and (new.branch_id is null or staff.branch_id = new.branch_id));
  return new;
end;
$$;
revoke execute on function public.alert_staff_payment() from public, anon, authenticated;

create or replace function public.withdraw_card_payments(p_payments uuid[])
returns integer language plpgsql security definer set search_path = public as $$
declare withdrawn integer;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  perform set_config('app.privileged', 'on', true);
  update payments set status = 'rejected'
   where id = any(p_payments) and user_id = auth.uid()
     and method = 'paystack' and status = 'pending';
  get diagnostics withdrawn = row_count;
  return withdrawn;
end;
$$;
revoke execute on function public.withdraw_card_payments(uuid[]) from public, anon;
grant execute on function public.withdraw_card_payments(uuid[]) to authenticated;

-- Card checkouts left open and never paid are withdrawn on the next one.
create index if not exists payments_pending_card_idx on payments (user_id) where status = 'pending' and method = 'paystack';
