-- Birthdays belong to the room you are standing in.
--
-- A member scanning in at Lekki has no idea who trains at Ikeja, and putting a
-- stranger's face up is worse than saying nothing. The list is now taken from
-- the branch the scan happened at, and a member with no branch on file sees
-- only people who also have none.

drop function if exists public.birthdays_today();

create or replace function public.birthdays_today(p_branch uuid default null)
returns table (username text, full_name text, photo_url text)
language sql stable security definer set search_path = public as $$
  select p.username::text, p.full_name, p.photo_url
    from profiles p
   where p.role = 'member'
     and p.date_of_birth is not null
     and to_char(p.date_of_birth, 'MM-DD') = to_char(now(), 'MM-DD')
     and p.expires_at is not null
     and p.expires_at >= now()
     and p.id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
     -- same floor, or both unassigned
     and p.branch_id is not distinct from coalesce(
           p_branch,
           (select branch_id from profiles where id = auth.uid())
         )
   order by p.username
   limit 5
$$;

grant execute on function public.birthdays_today(uuid) to authenticated;
