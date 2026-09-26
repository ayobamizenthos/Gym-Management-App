-- Push notifications.
--
-- The in-app alert only reaches someone who happens to have the app open. The
-- point of a notification is the opposite: it reaches them when they do not.
--
-- Each device registers its own subscription, so one member with a phone and a
-- tablet gets both. A subscription that the push service rejects as gone is
-- deleted rather than retried forever - browsers rotate these constantly.
--
-- Nothing here can be read across accounts: a subscription is a capability to
-- send to somebody's phone, so it is treated like a credential.

create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists push_own_select on public.push_subscriptions;
create policy push_own_select on public.push_subscriptions for select to authenticated
  using (user_id = auth.uid());

drop policy if exists push_own_insert on public.push_subscriptions;
create policy push_own_insert on public.push_subscriptions for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists push_own_delete on public.push_subscriptions;
create policy push_own_delete on public.push_subscriptions for delete to authenticated
  using (user_id = auth.uid());

grant select, insert, delete on public.push_subscriptions to authenticated;

-- A notification that has not been pushed yet is the queue. Marking it pushed is
-- what stops a member who was offline for a day from being buried when they
-- reconnect - they get the backlog once, not on every reconnect.
alter table public.notifications
  add column if not exists pushed_at timestamptz;

create index if not exists notifications_unpushed_idx
  on public.notifications(created_at) where pushed_at is null;
