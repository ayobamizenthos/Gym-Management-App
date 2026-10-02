-- Workouts: an exercise library, routines, logged sessions and personal bests.
--
-- Training is free for every member, whatever their plan. Sessions are written
-- only through finish_workout, which recomputes volume and personal bests on
-- the server so a record on the celebration screen is always a real one.

create table if not exists public.exercises (
  id         text primary key,
  name       text not null,
  body_part  text not null,
  target     text not null,
  secondary  text[] not null default '{}',
  equipment  text not null,
  steps      text[] not null default '{}',
  rank       integer not null default 0
);
create index if not exists exercises_rank_idx on public.exercises (rank desc, name);

-- One set as it travels in routines and logged sessions.
create or replace function public.valid_sets(p_sets jsonb)
returns boolean language sql immutable as $$
  select jsonb_typeof(p_sets) = 'array'
     and jsonb_array_length(p_sets) between 1 and 20
     and not exists (
       select 1 from jsonb_array_elements(p_sets) s
        where coalesce(s->>'kind', '') not in ('normal', 'warmup')
           or (s ? 'kg'   and s->'kg'   <> 'null'::jsonb and ((s->>'kg')::numeric   < 0 or (s->>'kg')::numeric   > 1000))
           or (s ? 'reps' and s->'reps' <> 'null'::jsonb and ((s->>'reps')::numeric < 0 or (s->>'reps')::numeric > 1000))
     )
$$;

create or replace function public.valid_entries(p_entries jsonb)
returns boolean language sql immutable as $$
  select jsonb_typeof(p_entries) = 'array'
     and jsonb_array_length(p_entries) between 0 and 40
     and not exists (
       select 1 from jsonb_array_elements(p_entries) e
        where jsonb_typeof(e->'exercise_id') <> 'string'
           or not public.valid_sets(e->'sets')
           or coalesce((e->>'rest')::integer, 0) not between 0 and 600
     )
$$;

-- owner_id null marks one of the gym's ready-made workouts under Explore.
create table if not exists public.routines (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid references public.profiles(id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 60),
  summary     text check (char_length(summary) <= 80),
  entries     jsonb not null default '[]' check (public.valid_entries(entries)),
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists routines_owner_idx on public.routines (owner_id, position);

create table if not exists public.workouts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  routine_id  uuid references public.routines(id) on delete set null,
  name        text not null,
  started_at  timestamptz not null,
  ended_at    timestamptz not null,
  entries     jsonb not null check (public.valid_entries(entries)),
  volume_kg   numeric not null default 0,
  set_count   integer not null default 0,
  records     jsonb not null default '[]',
  created_at  timestamptz not null default now()
);
create index if not exists workouts_user_idx on public.workouts (user_id, ended_at desc);
create index if not exists workouts_entries_idx on public.workouts using gin (entries jsonb_path_ops);

create table if not exists public.personal_records (
  user_id      uuid not null references public.profiles(id) on delete cascade,
  exercise_id  text not null references public.exercises(id),
  best_kg      numeric not null default 0,
  best_kg_reps integer not null default 0,
  best_reps    integer not null default 0,
  best_1rm     numeric not null default 0,
  updated_at   timestamptz not null default now(),
  primary key (user_id, exercise_id)
);

-- A rest timer that runs out while the app is in the background.
create table if not exists public.rest_alarms (
  user_id     uuid primary key references public.profiles(id) on delete cascade,
  fire_at     timestamptz not null,
  title       text not null check (char_length(title) <= 80),
  body        text not null check (char_length(body) <= 120)
);
create index if not exists rest_alarms_due_idx on public.rest_alarms (fire_at);

alter table public.exercises        enable row level security;
alter table public.routines         enable row level security;
alter table public.workouts         enable row level security;
alter table public.personal_records enable row level security;
alter table public.rest_alarms      enable row level security;

create policy exercises_read on public.exercises for select to authenticated using (true);

create policy routines_read  on public.routines for select to authenticated using (owner_id = auth.uid() or owner_id is null);
create policy routines_own   on public.routines for all    to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy routines_gym   on public.routines for all    to authenticated using (owner_id is null and public.is_admin()) with check (owner_id is null and public.is_admin());

create policy workouts_read  on public.workouts for select to authenticated using (user_id = auth.uid());
create policy records_read   on public.personal_records for select to authenticated using (user_id = auth.uid());
create policy rest_alarm_own on public.rest_alarms for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select on public.exercises, public.workouts, public.personal_records to authenticated;
grant select, insert, update, delete on public.routines, public.rest_alarms to authenticated;

create or replace function public.touch_routine()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists routines_touch on public.routines;
create trigger routines_touch before update on public.routines for each row execute function public.touch_routine();

-- Consecutive weeks, ending with the current one, that hold at least one workout.
create or replace function public.workout_streak_weeks(p_user uuid)
returns integer language sql stable security definer set search_path = public as $$
  with weeks as (
    select distinct date_trunc('week', ended_at at time zone 'Africa/Lagos')::date as week
      from workouts where user_id = p_user
  ), numbered as (
    select week, row_number() over (order by week desc) as n from weeks
  )
  select count(*)::integer from numbered
   where week = (date_trunc('week', now() at time zone 'Africa/Lagos')::date - ((n - 1) * 7)::integer)
$$;
revoke execute on function public.workout_streak_weeks(uuid) from public, anon;
grant execute on function public.workout_streak_weeks(uuid) to authenticated;

/**
 * Saves a finished session. Only sets the member ticked arrive here. Personal
 * bests are measured against what was on record before this session; an
 * exercise done for the first time sets the record without celebrating it.
 */
create or replace function public.finish_workout(p_routine uuid, p_name text, p_started timestamptz, p_entries jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  saved uuid;
  volume numeric;
  sets integer;
  found_records jsonb := '[]'::jsonb;
  entry record;
  prior personal_records%rowtype;
  top_kg numeric;
  top_kg_reps integer;
  top_reps integer;
  top_1rm numeric;
begin
  if me is null then raise exception 'not authenticated'; end if;
  if not public.valid_entries(p_entries) or jsonb_array_length(p_entries) = 0 then
    raise exception 'nothing to save';
  end if;
  if p_started > now() + interval '1 minute' or p_started < now() - interval '24 hours' then
    raise exception 'start time out of range';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_entries) e
     where not exists (select 1 from exercises x where x.id = e->>'exercise_id')
  ) then
    raise exception 'unknown exercise';
  end if;

  select coalesce(sum(coalesce((s->>'kg')::numeric, 0) * coalesce((s->>'reps')::numeric, 0)), 0), count(*)
    into volume, sets
    from jsonb_array_elements(p_entries) e, jsonb_array_elements(e->'sets') s;

  for entry in
    select e->>'exercise_id' as exercise_id, e->'sets' as sets
      from jsonb_array_elements(p_entries) e
  loop
    select coalesce(max(coalesce((s->>'kg')::numeric, 0)), 0),
           coalesce(max(coalesce((s->>'reps')::numeric, 0))::integer, 0),
           coalesce(max(coalesce((s->>'kg')::numeric, 0) * (1 + least(coalesce((s->>'reps')::numeric, 0), 12) / 30.0)), 0)
      into top_kg, top_reps, top_1rm
      from jsonb_array_elements(entry.sets) s
     where s->>'kind' = 'normal' and coalesce((s->>'reps')::numeric, 0) > 0;

    select coalesce(max((s->>'reps')::integer), 0) into top_kg_reps
      from jsonb_array_elements(entry.sets) s
     where s->>'kind' = 'normal' and coalesce((s->>'kg')::numeric, 0) = top_kg and coalesce((s->>'reps')::numeric, 0) > 0;

    select * into prior from personal_records where user_id = me and exercise_id = entry.exercise_id;

    if found then
      if top_kg > 0 and top_kg > prior.best_kg then
        found_records := found_records || jsonb_build_object('exercise_id', entry.exercise_id, 'kind', 'weight', 'kg', top_kg, 'reps', top_kg_reps);
      elsif top_kg = 0 and prior.best_kg = 0 and top_reps > prior.best_reps then
        found_records := found_records || jsonb_build_object('exercise_id', entry.exercise_id, 'kind', 'reps', 'reps', top_reps);
      end if;
    end if;

    if top_reps > 0 then
      insert into personal_records (user_id, exercise_id, best_kg, best_kg_reps, best_reps, best_1rm)
      values (me, entry.exercise_id, top_kg, top_kg_reps, top_reps, round(top_1rm, 1))
      on conflict (user_id, exercise_id) do update set
        best_kg_reps = case when excluded.best_kg > personal_records.best_kg then excluded.best_kg_reps
                            when excluded.best_kg = personal_records.best_kg then greatest(personal_records.best_kg_reps, excluded.best_kg_reps)
                            else personal_records.best_kg_reps end,
        best_kg   = greatest(personal_records.best_kg, excluded.best_kg),
        best_reps = greatest(personal_records.best_reps, excluded.best_reps),
        best_1rm  = greatest(personal_records.best_1rm, excluded.best_1rm),
        updated_at = now();
    end if;
  end loop;

  insert into workouts (user_id, routine_id, name, started_at, ended_at, entries, volume_kg, set_count, records)
  values (
    me,
    (select id from routines where id = p_routine and (owner_id = me or owner_id is null)),
    left(coalesce(nullif(btrim(p_name), ''), 'Workout'), 60),
    p_started, now(), p_entries, volume, sets, found_records
  )
  returning id into saved;

  delete from rest_alarms where user_id = me;

  return jsonb_build_object(
    'id', saved,
    'records', found_records,
    'ordinal', (select count(*) from workouts where user_id = me),
    'streak_weeks', public.workout_streak_weeks(me)
  );
end;
$$;
revoke execute on function public.finish_workout(uuid, text, timestamptz, jsonb) from public, anon;
grant execute on function public.finish_workout(uuid, text, timestamptz, jsonb) to authenticated;

-- The sets from the last session that included each exercise: the "previous" column.
create or replace function public.last_sets(p_exercises text[])
returns table (exercise_id text, sets jsonb) language sql stable security definer set search_path = public as $$
  select x.id, latest.sets
    from unnest(p_exercises) as x(id)
    cross join lateral (
      select e->'sets' as sets
        from workouts w, jsonb_array_elements(w.entries) e
       where w.user_id = auth.uid()
         and w.entries @> jsonb_build_array(jsonb_build_object('exercise_id', x.id))
         and e->>'exercise_id' = x.id
       order by w.ended_at desc
       limit 1
    ) latest
$$;
revoke execute on function public.last_sets(text[]) from public, anon;
grant execute on function public.last_sets(text[]) to authenticated;

-- Rest alarms that are due, handed to the push sender exactly once.
create or replace function public.claim_rest_alarms()
returns setof rest_alarms language sql security definer set search_path = public as $$
  delete from rest_alarms
   where user_id in (
     select user_id from rest_alarms
      where fire_at <= now() + interval '1 second'
      for update skip locked
   )
  returning *
$$;
revoke execute on function public.claim_rest_alarms() from public, anon, authenticated;
grant execute on function public.claim_rest_alarms() to service_role;

-- Every few seconds: wake the push sender only when a rest timer has run out.
create or replace function public.rest_alarm_tick()
returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  target text;
  secret text;
begin
  if not exists (select 1 from rest_alarms where fire_at <= now() + interval '1 second') then return; end if;
  select value into target from app_config where key = 'dispatch_url';
  select value into secret from app_config where key = 'dispatch_secret';
  if target is null or secret is null then return; end if;
  perform net.http_post(
    url     := target,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || secret),
    body    := '{}'::jsonb
  );
end;
$$;
revoke execute on function public.rest_alarm_tick() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'rest-alarms';
select cron.schedule('rest-alarms', '5 seconds', 'select public.rest_alarm_tick()');
