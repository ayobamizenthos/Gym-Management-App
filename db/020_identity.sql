-- Who owns a member's identity.
--
-- The name on a profile is what the receptionist reads off the check-in screen,
-- what every payment row is reconciled against, and what the audit log points
-- at. If a member can rewrite it at will, the front desk loses its only way to
-- tell two people apart, and a member could rename themselves to match someone
-- with an active plan to walk in on it.
--
-- So the name and date of birth are set by whoever registers the member and
-- corrected by staff. Everything a member genuinely owns - phone, address,
-- emergency contact, photo - stays theirs to keep current, and the emergency
-- contact in particular has to be easy for them to fix.

create or replace function public.guard_profile()
returns trigger language plpgsql as $fn$
begin
  if public.is_trusted_writer() then return new; end if;

  new.expires_at        := old.expires_at;
  new.registration_paid := old.registration_paid;
  new.referred_by       := old.referred_by;
  new.member_code       := old.member_code;
  new.username          := old.username;
  new.email             := old.email;
  new.created_at        := old.created_at;

  -- identity is staff-maintained
  if not public.is_staff() then
    new.full_name     := old.full_name;
    new.date_of_birth := old.date_of_birth;
  end if;

  if not public.is_admin() then
    new.role      := old.role;
    new.branch_id := old.branch_id;
  end if;

  return new;
end;$fn$;
