-- Fire the sender the moment a notification is written.
--
-- pg_net posts without blocking the transaction that created the alert, so a
-- slow push service can never hold up a payment being confirmed at the desk.
-- If the call fails, nothing is lost: the row simply keeps its null pushed_at
-- and the next run picks it up, which is also what covers a member whose phone
-- was off when the alert was created.

create extension if not exists pg_net with schema extensions;

create table if not exists public.app_config (
  key   text primary key,
  value text not null
);
alter table public.app_config enable row level security;
revoke all on public.app_config from anon, authenticated;

create or replace function public.notify_push()
returns trigger language plpgsql security definer set search_path to 'public, extensions' as $fn$
declare
  base text;
  secret text;
begin
  select value into base   from app_config where key = 'app_url';
  select value into secret from app_config where key = 'service_key';
  if base is null or secret is null then return new; end if;

  perform net.http_post(
    url     := base || '/api/push/dispatch',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || secret),
    body    := '{}'::jsonb
  );
  return new;
end;$fn$;

drop trigger if exists notify_push_trg on public.notifications;
create trigger notify_push_trg after insert on public.notifications
  for each statement execute function public.notify_push();
