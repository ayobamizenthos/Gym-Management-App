-- Push delivery that neither repeats nor loses an alert.
--
-- A dispatch run now claims the rows it sends, so two runs started by the same
-- burst of inserts cannot both deliver them. A claim expires after two minutes,
-- which is how a run that failed half way gives its rows back. A five minute
-- backstop picks up anything a failed trigger call left behind.
--
-- The dispatcher is called with its own secret instead of the service key, and
-- devices register through one function that also hands a shared front desk
-- phone over to whoever signed in on it last.

alter table notifications add column if not exists push_claimed_at timestamptz;
create index if not exists notifications_unpushed_idx on notifications (created_at) where pushed_at is null;

create or replace function public.claim_pushes(p_limit integer)
returns setof notifications language sql security definer set search_path = public as $$
  update notifications
     set push_claimed_at = now()
   where id in (
     select id from notifications
      where pushed_at is null
        and (push_claimed_at is null or push_claimed_at < now() - interval '2 minutes')
      order by created_at
      limit p_limit
      for update skip locked
   )
  returning *
$$;
revoke execute on function public.claim_pushes(integer) from public, anon, authenticated;
grant execute on function public.claim_pushes(integer) to service_role;

insert into app_config (key, value)
values ('dispatch_secret', encode(extensions.gen_random_bytes(32), 'hex'))
on conflict (key) do nothing;

create or replace function public.notify_push()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  base text;
  secret text;
begin
  select value into base   from public.app_config where key = 'app_url';
  select value into secret from public.app_config where key = 'dispatch_secret';
  if base is null or secret is null then return new; end if;

  begin
    perform net.http_post(
      url     := base || '/api/push/dispatch',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || secret),
      body    := '{}'::jsonb
    );
  exception when others then
    -- the row keeps its null pushed_at and the backstop collects it
    null;
  end;
  return new;
end;
$$;
revoke execute on function public.notify_push() from public, anon, authenticated;

delete from app_config where key = 'service_key';

create or replace function public.push_backstop()
returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  base text;
  secret text;
begin
  if not exists (
    select 1 from notifications
     where pushed_at is null and created_at < now() - interval '1 minute'
       and (push_claimed_at is null or push_claimed_at < now() - interval '2 minutes')
  ) then
    return;
  end if;
  select value into base   from app_config where key = 'app_url';
  select value into secret from app_config where key = 'dispatch_secret';
  if base is null or secret is null then return; end if;
  perform net.http_post(
    url     := base || '/api/push/dispatch',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || secret),
    body    := '{}'::jsonb
  );
end;
$$;
revoke execute on function public.push_backstop() from public, anon, authenticated;

create extension if not exists pg_cron;
select cron.unschedule(jobid) from cron.job where jobname = 'push-backstop';
select cron.schedule('push-backstop', '*/5 * * * *', 'select public.push_backstop()');

-- Only real browser push services, so a crafted endpoint cannot make the
-- dispatcher call an arbitrary host.
alter table push_subscriptions drop constraint if exists push_subscriptions_endpoint_host;
alter table push_subscriptions add constraint push_subscriptions_endpoint_host check (
  endpoint ~ '^https://(fcm\.googleapis\.com|([a-z0-9-]+\.)*push\.apple\.com|updates\.push\.services\.mozilla\.com|([a-z0-9-]+\.)*notify\.windows\.com)/'
);

create or replace function public.register_push_device(p_endpoint text, p_p256dh text, p_auth text, p_agent text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, left(p_agent, 200))
  on conflict (endpoint) do update
     set user_id = excluded.user_id,
         p256dh = excluded.p256dh,
         auth = excluded.auth,
         user_agent = excluded.user_agent,
         last_used_at = now();
end;
$$;
revoke execute on function public.register_push_device(text, text, text, text) from public, anon;
grant execute on function public.register_push_device(text, text, text, text) to authenticated;

-- An open card checkout is not a payment waiting on the desk.
do $$
declare body text;
  counted constant text := '''pending_payments'',(select count(*) from payments where status = ''pending'' and public.staff_covers(branch_id))';
begin
  select pg_get_functiondef('public.admin_summary(timestamptz, timestamptz)'::regprocedure) into body;
  if position(counted in body) = 0 then raise exception 'admin_summary changed; review before applying'; end if;
  execute replace(body, counted,
    '''pending_payments'',(select count(*) from payments where status = ''pending'' and method <> ''paystack'' and public.staff_covers(branch_id))');
end $$;
