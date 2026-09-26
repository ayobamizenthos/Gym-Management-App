-- Notifications become a real inbox rather than a fire-and-forget toast.
--
-- Everything already lands in this table; what was missing is the ability to
-- mark things read, clear them, and turn them off. Marking read has to be
-- narrow: a member owns the read flag on their own rows and nothing else, or
-- they could rewrite the text of a payment alert staff rely on.

alter table public.profiles
  add column if not exists notifications_enabled boolean not null default true;

create or replace function public.guard_notification()
returns trigger language plpgsql as $fn$
begin
  if public.is_trusted_writer() then return new; end if;
  -- the read flag is the only thing a recipient may move
  new.user_id    := old.user_id;
  new.type       := old.type;
  new.title      := old.title;
  new.message    := old.message;
  new.created_at := old.created_at;
  return new;
end;$fn$;

drop trigger if exists guard_notification_trg on public.notifications;
create trigger guard_notification_trg before update on public.notifications
  for each row execute function public.guard_notification();

-- clearing your own inbox
drop policy if exists notif_own_del on public.notifications;
create policy notif_own_del on public.notifications for delete to authenticated
  using (user_id = auth.uid());
grant delete on public.notifications to authenticated;

create index if not exists notifications_unread_idx
  on public.notifications(user_id, is_read, created_at desc);

-- A member who has switched alerts off still gets the record; the app simply
-- stays quiet. Anything tied to money is never suppressed, because a member has
-- to be told their payment was rejected whatever their preference.
create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns integer language plpgsql security definer set search_path to 'public' as $fn$
declare uid uuid := auth.uid(); touched integer;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  perform set_config('app.privileged','on',true);
  update notifications set is_read = true
    where user_id = uid and is_read = false
      and (p_ids is null or id = any(p_ids));
  get diagnostics touched = row_count;
  return touched;
end;$fn$;

grant execute on function public.mark_notifications_read(uuid[]) to authenticated;
