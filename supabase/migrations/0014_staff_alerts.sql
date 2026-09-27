-- Front desk and management are told the moment a member joins or files a
-- transfer, so nobody has to keep refreshing a list.
create or replace function public.alert_staff_new_member()
returns trigger language plpgsql security definer set search_path to 'public' as $fn$
declare staff uuid;
begin
  if new.role <> 'member' then return new; end if;
  for staff in select id from profiles where role in ('admin','receptionist') loop
    insert into notifications (user_id, type, title, message)
    values (staff, 'member_joined', 'New member',
            coalesce(new.full_name, 'A new member') || ' just signed up.');
  end loop;
  return new;
end;$fn$;

drop trigger if exists alert_staff_new_member_trg on public.profiles;
create trigger alert_staff_new_member_trg after insert on public.profiles
  for each row execute function public.alert_staff_new_member();

create or replace function public.alert_staff_payment()
returns trigger language plpgsql security definer set search_path to 'public' as $fn$
declare staff uuid; who text;
begin
  if new.status <> 'pending' then return new; end if;
  select coalesce(full_name, 'A member') into who from profiles where id = new.user_id;
  for staff in select id from profiles where role in ('admin','receptionist') loop
    insert into notifications (user_id, type, title, message)
    values (staff, 'payment_pending', 'Payment to confirm',
            who || ' sent ' || to_char(new.amount, 'FM999,999,999') || ' naira for confirmation.');
  end loop;
  return new;
end;$fn$;

drop trigger if exists alert_staff_payment_trg on public.payments;
create trigger alert_staff_payment_trg after insert on public.payments
  for each row execute function public.alert_staff_payment();
