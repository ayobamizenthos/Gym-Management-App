-- A quoted search_path is one schema name, not a list.
--
-- 'public, extensions' was being read as a single schema literally called
-- "public, extensions", so the trigger could not see app_config and every
-- notification insert failed with it - which took confirming a payment down
-- with it. Unquoted, these are two schemas, which is what was meant.

create or replace function public.notify_push()
returns trigger language plpgsql security definer set search_path = public, extensions as $fn$
declare
  base text;
  secret text;
begin
  select value into base   from public.app_config where key = 'app_url';
  select value into secret from public.app_config where key = 'service_key';
  if base is null or secret is null then return new; end if;

  -- never let a slow push service hold up the transaction that raised the alert
  begin
    perform net.http_post(
      url     := base || '/api/push/dispatch',
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || secret),
      body    := '{}'::jsonb
    );
  exception when others then
    -- the row keeps its null pushed_at and the next run collects it
    null;
  end;
  return new;
end;$fn$;
