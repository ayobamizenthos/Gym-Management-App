-- Zenthos Gym - core schema.
-- Money, membership expiry and roles are never writable by a client. Every
-- balance-affecting change runs through a SECURITY DEFINER function and is
-- mirrored into an append-only audit trail.

create extension if not exists citext;
create extension if not exists pgcrypto;

create type member_role  as enum ('member','receptionist','admin');
create type pay_method   as enum ('paystack','transfer','cash');
create type pay_status   as enum ('pending','confirmed','rejected');
create type checkin_kind as enum ('valid','expired','duplicate','no_membership');

create table branches (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  address     text,
  phone       text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table plans (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  price               numeric(12,2) not null check (price >= 0),
  duration_days       integer not null check (duration_days >= 0),
  counts_for_referral boolean not null default false,
  is_addon            boolean not null default false,
  is_active           boolean not null default true,
  sort_order          integer not null default 0,
  created_at          timestamptz not null default now()
);

create table profiles (
  id                 uuid primary key references auth.users(id) on delete cascade,
  full_name          text,
  phone              text,
  role               member_role not null default 'member',
  branch_id          uuid references branches(id) on delete set null,
  username           citext unique,
  referred_by        uuid references profiles(id) on delete set null,
  member_code        text unique,
  photo_url          text,
  registration_paid  boolean not null default false,
  expires_at         timestamptz,
  created_at         timestamptz not null default now(),
  constraint username_format check (username is null or (username)::text ~ '^[a-z0-9_]{3,20}$')
);

create table memberships (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  plan_id    uuid not null references plans(id),
  branch_id  uuid references branches(id) on delete set null,
  starts_at  timestamptz not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index memberships_user_idx on memberships(user_id, created_at desc);

create table payments (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references profiles(id) on delete cascade,
  plan_id        uuid references plans(id),
  branch_id      uuid references branches(id) on delete set null,
  amount         numeric(12,2) not null check (amount >= 0),
  method         pay_method not null,
  status         pay_status not null default 'pending',
  reference      text,
  proof_url      text,
  includes_registration boolean not null default false,
  confirmed_by   uuid references profiles(id) on delete set null,
  confirmed_at   timestamptz,
  created_at     timestamptz not null default now()
);
create index payments_status_idx on payments(status, created_at desc);
create index payments_user_idx   on payments(user_id, created_at desc);

create table check_ins (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  branch_id  uuid references branches(id) on delete set null,
  kind       checkin_kind not null,
  created_at timestamptz not null default now()
);
create index check_ins_user_day_idx on check_ins(user_id, created_at desc);
create index check_ins_branch_idx   on check_ins(branch_id, created_at desc);

create table referrals (
  id          uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references profiles(id) on delete cascade,
  referred_id uuid not null references profiles(id) on delete cascade unique,
  qualified_at timestamptz,
  rewarded_at  timestamptz,
  created_at   timestamptz not null default now(),
  constraint no_self_referral check (referrer_id <> referred_id)
);
create index referrals_referrer_idx on referrals(referrer_id);

create table notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  type       text not null,
  title      text not null,
  message    text not null,
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on notifications(user_id, created_at desc);

create table settings (
  id                       boolean primary key default true,
  gym_name                 text not null default 'Zenthos Gym',
  registration_fee         numeric(12,2) not null default 5000,
  referral_target          integer not null default 3,
  referral_reward_days     integer not null default 7,
  expiry_notice_days       integer not null default 5,
  checkin_window_hours     integer not null default 24,
  updated_at               timestamptz not null default now(),
  constraint settings_singleton check (id)
);
insert into settings (id) values (true);

create table audit_log (
  id         uuid primary key default gen_random_uuid(),
  actor_id   uuid references profiles(id) on delete set null,
  action     text not null,
  entity     text,
  entity_id  uuid,
  details    jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_idx on audit_log(created_at desc);
