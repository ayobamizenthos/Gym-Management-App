-- A receptionist works one branch: its members, its payments, its door, its
-- revenue. Admins keep the whole business. Members with no branch on file are
-- visible to every desk so nobody who signed up online falls through a gap.
--
-- Also restores the "New paid member" alert that 024 dropped when it redefined
-- confirm_payment, now sent only to the desks that branch belongs to.

create or replace function public.staff_covers(p_branch uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select role = 'admin'
        or (role = 'receptionist' and (p_branch is null or p_branch = branch_id))
      from profiles where id = auth.uid()
  ), false)
$$;

create or replace function public.staff_covers_member(p_member text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
     where id::text = p_member and role = 'member' and public.staff_covers(branch_id)
  )
$$;

revoke execute on function public.staff_covers(uuid) from public, anon;
revoke execute on function public.staff_covers_member(text) from public, anon;
grant execute on function public.staff_covers(uuid) to authenticated;
grant execute on function public.staff_covers_member(text) to authenticated;

drop policy if exists profiles_self on profiles;
create policy profiles_self on profiles for select to authenticated
  using (id = auth.uid() or public.is_admin() or (role = 'member' and public.staff_covers(branch_id)));

drop policy if exists profiles_update on profiles;
create policy profiles_update on profiles for update to authenticated
  using (id = auth.uid() or public.is_admin() or (role = 'member' and public.staff_covers(branch_id)))
  with check (id = auth.uid() or public.is_admin() or (role = 'member' and public.staff_covers(branch_id)));

drop policy if exists checkins_read on check_ins;
create policy checkins_read on check_ins for select to authenticated
  using (user_id = auth.uid() or public.staff_covers(branch_id));

drop policy if exists memberships_read on memberships;
create policy memberships_read on memberships for select to authenticated
  using (user_id = auth.uid() or public.staff_covers(branch_id));

drop policy if exists payments_read on payments;
create policy payments_read on payments for select to authenticated
  using (user_id = auth.uid() or public.staff_covers(branch_id));

drop policy if exists referrals_read on referrals;
create policy referrals_read on referrals for select to authenticated
  using (referrer_id = auth.uid() or referred_id = auth.uid() or public.is_admin());

drop policy if exists proofs_owner_read on storage.objects;
create policy proofs_owner_read on storage.objects for select to authenticated
  using (bucket_id = 'proofs' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.staff_covers_member((storage.foldername(name))[1])
  ));

-- Payment functions check the branch of the row they act on.
do $$
declare
  body text;
  handled constant text := 'if pay.status <> ''pending'' then raise exception ''payment already handled''; end if;';
  covered constant text := E'\n  if coalesce(auth.jwt() ->> ''role'', '''') <> ''service_role'' and not public.staff_covers(pay.branch_id) then\n    raise exception ''not permitted'';\n  end if;';
  joined constant text := E'  if not exists (select 1 from payments where user_id = p.id and status = ''confirmed'' and id <> pay.id) then\n    insert into notifications (user_id, type, title, message)\n    select staff.id, ''member_joined'', ''New paid member'',\n           coalesce(nullif(trim(p.full_name), ''''), ''A member'') || '' joined on '' || coalesce(pl.name, ''a plan'') || ''.''\n      from profiles staff\n     where staff.role = ''admin''\n        or (staff.role = ''receptionist'' and (pay.branch_id is null or staff.branch_id = pay.branch_id));\n  end if;\n\n  insert into audit_log (actor_id, action, entity, entity_id, details)\n  values (actor, ''confirm_payment''';
begin
  select pg_get_functiondef('public.confirm_payment(uuid)'::regprocedure) into body;
  if position(handled in body) = 0 or position('insert into audit_log (actor_id, action, entity, entity_id, details)' || E'\n  values (actor, ''confirm_payment''' in body) = 0 then
    raise exception 'confirm_payment changed; review before applying';
  end if;
  body := replace(body, handled, handled || covered);
  body := replace(body, 'insert into audit_log (actor_id, action, entity, entity_id, details)' || E'\n  values (actor, ''confirm_payment''', ltrim(joined));
  execute body;

  select pg_get_functiondef('public.reject_payment(uuid, text)'::regprocedure) into body;
  if position(handled in body) = 0 then raise exception 'reject_payment changed; review before applying'; end if;
  execute replace(body, handled, handled || covered);

  select pg_get_functiondef('public.record_payment(uuid, uuid, pay_method, text, boolean)'::regprocedure) into body;
  if position('if p.id is null then raise exception ''member not found''; end if;' in body) = 0 then
    raise exception 'record_payment changed; review before applying';
  end if;
  execute replace(body,
    'if p.id is null then raise exception ''member not found''; end if;',
    'if p.id is null or not public.staff_covers(p.branch_id) then raise exception ''member not found''; end if;');
end $$;

create or replace function public.alert_staff_payment()
returns trigger language plpgsql security definer set search_path = public as $$
declare who text;
begin
  if new.status <> 'pending' then return new; end if;
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

-- The desk overview shows the numbers for the branch it runs.
create or replace function public.admin_summary(p_from timestamptz, p_to timestamptz)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  s        settings;
  v_span   integer;
  v_grain  text;
  v_series jsonb;
begin
  if not public.is_staff() then raise exception 'not permitted'; end if;
  if p_from is null or p_to is null or p_from >= p_to then raise exception 'invalid range'; end if;
  if p_to - p_from > interval '5 years' then raise exception 'range too wide'; end if;

  select * into s from settings where id;
  v_span := greatest(1, p_to::date - p_from::date);
  v_grain := case when v_span > 92 then 'month' else 'day' end;

  select coalesce(jsonb_agg(jsonb_build_object(
           'bucket', to_char(b.slot, case when v_grain = 'month' then 'YYYY-MM' else 'YYYY-MM-DD' end),
           'total',  b.total
         ) order by b.slot), '[]'::jsonb)
    into v_series
  from (
    select g.slot, coalesce(sum(p.amount), 0) as total
      from generate_series(date_trunc(v_grain, p_from), date_trunc(v_grain, p_to), ('1 ' || v_grain)::interval) as g(slot)
      left join payments p
        on p.status = 'confirmed'
       and p.created_at >= greatest(g.slot, p_from)
       and p.created_at <  least(g.slot + ('1 ' || v_grain)::interval, p_to)
       and public.staff_covers(p.branch_id)
     group by g.slot
  ) b;

  return jsonb_build_object(
    'grain',   v_grain,
    'series',  v_series,
    'revenue', (select coalesce(sum(amount), 0) from payments
                 where status = 'confirmed' and created_at >= p_from and created_at < p_to
                   and public.staff_covers(branch_id)),
    'revenue_all',     (select coalesce(sum(amount), 0) from payments
                         where status = 'confirmed' and public.staff_covers(branch_id)),
    'members_total',   (select count(*) from profiles where role = 'member' and public.staff_covers(branch_id)),
    'members_active',  (select count(*) from profiles where role = 'member' and expires_at >= now()
                         and public.staff_covers(branch_id)),
    'members_expired', (select count(*) from profiles where role = 'member' and expires_at < now()
                         and public.staff_covers(branch_id)),
    'joined_period',   (select count(*) from profiles where role = 'member'
                         and created_at >= p_from and created_at < p_to and public.staff_covers(branch_id)),
    'renewals_due',    (select count(*) from profiles where role = 'member'
                         and expires_at >= now() and expires_at <= now() + make_interval(days => s.expiry_notice_days)
                         and public.staff_covers(branch_id)),
    'visits_period',   (select count(*) from check_ins where created_at >= p_from and created_at < p_to
                         and public.staff_covers(branch_id)),
    'visits_today',    (select count(*) from check_ins where created_at >= date_trunc('day', now())
                         and public.staff_covers(branch_id)),
    'pending_payments',(select count(*) from payments where status = 'pending' and public.staff_covers(branch_id)),
    'referrals_rewarded', case when public.is_admin()
                            then (select count(*) from referrals where rewarded_at is not null) else 0 end
  );
end;
$$;
revoke execute on function public.admin_summary(timestamptz, timestamptz) from public, anon;
grant execute on function public.admin_summary(timestamptz, timestamptz) to authenticated;

-- Superseded by admin_summary and no longer called.
revoke execute on function public.admin_overview(integer) from public, anon, authenticated;
revoke execute on function public.request_payment(uuid, pay_method, text, text, uuid) from public, anon, authenticated;
