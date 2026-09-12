-- The overview needs a shape, not a pile of totals.
--
-- One call returns both the headline figures for a window and the revenue
-- broken into buckets across it, so the dashboard can draw the trend without a
-- second round trip on a slow connection. The grain follows the window: days
-- for anything up to about three months, months beyond that, because sixty
-- one-pixel bars on a phone tell you nothing.

create or replace function public.admin_summary(
  p_from timestamptz,
  p_to   timestamptz
) returns jsonb language plpgsql security definer set search_path to 'public' as $fn$
declare
  s        settings;
  v_span   integer;
  v_grain  text;
  v_series jsonb;
  res      jsonb;
begin
  if not public.is_staff() then raise exception 'not permitted'; end if;
  if p_from is null or p_to is null or p_from >= p_to then
    raise exception 'invalid range';
  end if;
  -- a year of days is 365 rows nobody can read; cap the work as well as the chart
  if p_to - p_from > interval '5 years' then raise exception 'range too wide'; end if;

  select * into s from settings where id;
  v_span := greatest(1, (p_to::date - p_from::date));
  v_grain := case when v_span > 92 then 'month' else 'day' end;

  select coalesce(jsonb_agg(jsonb_build_object(
           'bucket', to_char(b.slot, case when v_grain = 'month' then 'YYYY-MM' else 'YYYY-MM-DD' end),
           'total',  b.total
         ) order by b.slot), '[]'::jsonb)
    into v_series
  from (
    select g.slot,
           coalesce(sum(p.amount), 0) as total
      from generate_series(date_trunc(v_grain, p_from), date_trunc(v_grain, p_to), ('1 ' || v_grain)::interval) as g(slot)
      left join payments p
        on p.status = 'confirmed'
       and p.created_at >= g.slot
       and p.created_at <  g.slot + ('1 ' || v_grain)::interval
       and p.created_at >= p_from
       and p.created_at <  p_to
     group by g.slot
  ) b;

  select jsonb_build_object(
    'grain',   v_grain,
    'series',  v_series,
    'revenue', (select coalesce(sum(amount),0) from payments
                 where status='confirmed' and created_at >= p_from and created_at < p_to),
    'revenue_all',     (select coalesce(sum(amount),0) from payments where status='confirmed'),
    'members_total',   (select count(*) from profiles where role='member'),
    'members_active',  (select count(*) from profiles where role='member' and expires_at >= now()),
    'members_expired', (select count(*) from profiles where role='member' and expires_at < now()),
    'joined_period',   (select count(*) from profiles
                         where role='member' and created_at >= p_from and created_at < p_to),
    'renewals_due',    (select count(*) from profiles where role='member'
                         and expires_at >= now() and expires_at <= now() + make_interval(days => s.expiry_notice_days)),
    'visits_period',   (select count(*) from check_ins where created_at >= p_from and created_at < p_to),
    'visits_today',    (select count(*) from check_ins where created_at::date = now()::date),
    'pending_payments',(select count(*) from payments where status='pending'),
    'referrals_rewarded',(select count(*) from referrals where rewarded_at is not null)
  ) into res;

  return res;
end;$fn$;

grant execute on function public.admin_summary(timestamptz, timestamptz) to authenticated;
