-- Sign-in and sign-up go through the app's server, so Supabase sees every
-- attempt coming from the host's shared addresses and its own per-address limit
-- would either lock everybody out or nobody. The server counts attempts per
-- client address and per account here instead.

create table if not exists public.auth_attempts (
  bucket     text not null,
  created_at timestamptz not null default now()
);
create index if not exists auth_attempts_bucket_idx on public.auth_attempts (bucket, created_at);
alter table public.auth_attempts enable row level security;
revoke all on public.auth_attempts from anon, authenticated;

create or replace function public.allow_attempt(p_bucket text, p_limit integer, p_window interval)
returns boolean language plpgsql security definer set search_path = public as $$
declare recent integer;
begin
  delete from auth_attempts where created_at < now() - interval '1 day';
  select count(*) into recent from auth_attempts where bucket = p_bucket and created_at > now() - p_window;
  if recent >= p_limit then return false; end if;
  insert into auth_attempts (bucket) values (p_bucket);
  return true;
end;
$$;
revoke execute on function public.allow_attempt(text, integer, interval) from public, anon, authenticated;
grant execute on function public.allow_attempt(text, integer, interval) to service_role;
