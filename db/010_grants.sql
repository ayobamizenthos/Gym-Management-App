-- Auto-expose was deliberately left off, so every privilege is granted by hand.
-- RLS still decides which rows; these grants only decide which verbs exist.
grant usage on schema public to anon, authenticated;

-- Read-only reference data.
grant select on public.branches, public.plans, public.settings to anon, authenticated;

-- Admin-managed content: the verb exists, RLS limits it to admins.
grant insert, update, delete on public.branches, public.plans to authenticated;
grant update on public.settings to authenticated;

-- A member reads/updates their own row; the guard trigger freezes money columns.
grant select, update on public.profiles to authenticated;

-- History is read-only to clients. Rows are written by SECURITY DEFINER functions.
grant select on public.memberships, public.check_ins, public.referrals, public.audit_log to authenticated;

-- Members may file a pending payment; status/amount are re-derived server side.
grant select, insert on public.payments to authenticated;

-- Notifications: read plus mark-as-read.
grant select, update on public.notifications to authenticated;

-- Nothing may be deleted by a client on the money/audit trail.
revoke delete on public.payments, public.memberships, public.check_ins,
                 public.referrals, public.audit_log, public.notifications, public.profiles
  from authenticated;
