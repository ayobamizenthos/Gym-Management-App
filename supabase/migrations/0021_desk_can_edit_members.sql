-- The front desk is the person a member actually stands in front of when their
-- phone number changes or their name was typed wrong on the paper form, but the
-- update policy only ever allowed "yourself, or an admin". That left the desk
-- unable to fix anything and pushed every correction to the owner.
--
-- Staff may now write to member rows only. A receptionist still cannot touch
-- another member of staff, which is what would otherwise let them edit their way
-- into the admin account, and guard_profile() continues to freeze role, branch,
-- expiry, the joining fee, the invite name and the email on every one of these
-- writes.

drop policy if exists profiles_update on public.profiles;

create policy profiles_update on public.profiles for update to authenticated
  using (
    id = auth.uid()
    or public.is_admin()
    or (public.is_staff() and profiles.role = 'member')
  )
  with check (
    id = auth.uid()
    or public.is_admin()
    or (public.is_staff() and profiles.role = 'member')
  );
