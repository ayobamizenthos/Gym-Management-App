-- Push dispatch runs as a Supabase function, so the trigger and the backstop
-- call it directly instead of going through the web host.
insert into app_config (key, value)
values ('dispatch_url', 'https://bzwazfarriziiwodqltu.supabase.co/functions/v1/push-dispatch')
on conflict (key) do update set value = excluded.value;

create or replace function public.notify_push()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  target text;
  secret text;
begin
  select value into target from public.app_config where key = 'dispatch_url';
  select value into secret from public.app_config where key = 'dispatch_secret';
  if target is null or secret is null then return new; end if;

  begin
    perform net.http_post(
      url     := target,
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

create or replace function public.push_backstop()
returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  target text;
  secret text;
begin
  if not exists (
    select 1 from notifications
     where pushed_at is null and created_at < now() - interval '1 minute'
       and (push_claimed_at is null or push_claimed_at < now() - interval '2 minutes')
  ) then
    return;
  end if;
  select value into target from app_config where key = 'dispatch_url';
  select value into secret from app_config where key = 'dispatch_secret';
  if target is null or secret is null then return; end if;
  perform net.http_post(
    url     := target,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || secret),
    body    := '{}'::jsonb
  );
end;
$$;
revoke execute on function public.push_backstop() from public, anon, authenticated;
