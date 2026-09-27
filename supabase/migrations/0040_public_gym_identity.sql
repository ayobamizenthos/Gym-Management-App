-- Signed-out screens (sign in, sign up, the door, the installed app's name)
-- show the gym's own name, so visitors may read the settings row. Nothing in it
-- is private: the name, the published fees and the check-in rules.

drop policy if exists settings_read_anon on settings;
create policy settings_read_anon on settings for select to anon using (true);

-- Member totals per branch in one query, for the branches screen.
create or replace function public.branch_member_counts()
returns table (branch_id uuid, members bigint)
language sql stable security definer set search_path = public as $$
  select p.branch_id, count(*)
    from profiles p
   where p.role = 'member' and public.is_admin()
   group by p.branch_id
$$;
revoke execute on function public.branch_member_counts() from public, anon;
grant execute on function public.branch_member_counts() to authenticated;
