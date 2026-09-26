-- Deleting a member removes the person, not the gym's books. Payments, visits,
-- membership periods and settled card references stay, detached from the
-- account, so past revenue and attendance never change after the fact.

alter table payments alter column user_id drop not null;
alter table payments drop constraint payments_user_id_fkey,
  add constraint payments_user_id_fkey foreign key (user_id) references profiles(id) on delete set null;

alter table check_ins alter column user_id drop not null;
alter table check_ins drop constraint check_ins_user_id_fkey,
  add constraint check_ins_user_id_fkey foreign key (user_id) references profiles(id) on delete set null;

alter table memberships alter column user_id drop not null;
alter table memberships drop constraint memberships_user_id_fkey,
  add constraint memberships_user_id_fkey foreign key (user_id) references profiles(id) on delete set null;

alter table paystack_settlements alter column user_id drop not null;
alter table paystack_settlements drop constraint paystack_settlements_user_id_fkey,
  add constraint paystack_settlements_user_id_fkey foreign key (user_id) references profiles(id) on delete set null;

-- Indexes the desk feed, branch filters and settlement lookups rely on.
create index if not exists check_ins_created_idx on check_ins (created_at desc);
create index if not exists check_ins_branch_created_idx on check_ins (branch_id, created_at desc);
create index if not exists profiles_branch_idx on profiles (branch_id) where role = 'member';
create index if not exists payments_branch_status_idx on payments (branch_id, status);
create index if not exists payments_reference_idx on payments (reference) where reference is not null;

-- Stored photos are always a file in the member's own folder.
alter table profiles drop constraint if exists profiles_photo_path;
alter table profiles add constraint profiles_photo_path check (
  photo_url is null or photo_url ~ ('^' || id::text || '/avatar(-[0-9]+)?\.jpg$')
) not valid;

alter table profiles drop constraint if exists profiles_text_lengths;
alter table profiles add constraint profiles_text_lengths check (
  length(coalesce(full_name, '')) <= 120 and length(coalesce(phone, '')) <= 30
  and length(coalesce(address, '')) <= 240 and length(coalesce(emergency_contact, '')) <= 160
) not valid;

-- The sign up page greets people by the first name of whoever invited them.
create or replace function public.inviter_name(p_username text)
returns text language sql stable security definer set search_path = public as $$
  select split_part(trim(full_name), ' ', 1)
    from profiles
   where username = lower(trim(p_username))::citext and role = 'member'
$$;
revoke execute on function public.inviter_name(text) from public;
grant execute on function public.inviter_name(text) to anon, authenticated;

alter table profiles validate constraint profiles_photo_path;
alter table profiles validate constraint profiles_text_lengths;
