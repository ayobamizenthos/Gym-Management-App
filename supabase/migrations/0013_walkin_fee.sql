-- Registration is a joining fee. A walk-in is not joining, so it must never
-- attract it. Which plans carry the fee is now data, not a hardcoded rule.
alter table public.plans
  add column if not exists requires_registration boolean not null default true;

update public.plans set requires_registration = false where is_addon;
update public.plans set requires_registration = false where duration_days <= 1;

create or replace function public.registration_due(p_user uuid, p_plan uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select coalesce(
    (select pl.requires_registration and not pr.registration_paid
       from plans pl, profiles pr
      where pl.id = p_plan and pr.id = p_user),
    false)
$$;
