-- The gym's ready-made workouts under Explore. Weights are left for the member
-- to choose; reps and rest follow standard hypertrophy and strength practice.

create or replace function pg_temp.sets(p_count integer, p_reps integer, p_warmup boolean default false)
returns jsonb language sql as $$
  select (case when p_warmup then jsonb_build_array(jsonb_build_object('kind', 'warmup', 'kg', null, 'reps', 12)) else '[]'::jsonb end)
      || coalesce((select jsonb_agg(jsonb_build_object('kind', 'normal', 'kg', null, 'reps', p_reps)) from generate_series(1, p_count)), '[]'::jsonb)
$$;

create or replace function pg_temp.move(p_exercise text, p_rest integer, p_sets jsonb)
returns jsonb language sql as $$
  select jsonb_build_object('exercise_id', p_exercise, 'rest', p_rest, 'sets', p_sets)
$$;

insert into public.routines (owner_id, name, summary, position, entries)
select null, template.name, template.summary, template.position, template.entries
  from (values
    ('Full Body Starter', 'Beginner · 3 days a week', 1, jsonb_build_array(
      pg_temp.move('iYzB0Cz', 120, pg_temp.sets(3, 8, true)),
      pg_temp.move('EIeI8Vf', 120, pg_temp.sets(3, 8, true)),
      pg_temp.move('fUBheHs',  90, pg_temp.sets(3, 10)),
      pg_temp.move('znQUdHY',  90, pg_temp.sets(3, 10)),
      pg_temp.move('TFqbd8t',  60, pg_temp.sets(3, 15))
    )),
    ('Push Day', 'Chest, shoulders and triceps', 2, jsonb_build_array(
      pg_temp.move('EIeI8Vf', 120, pg_temp.sets(4, 8, true)),
      pg_temp.move('B3Rxp6L',  90, pg_temp.sets(3, 10)),
      pg_temp.move('znQUdHY',  90, pg_temp.sets(3, 10)),
      pg_temp.move('DsgkuIt',  60, pg_temp.sets(3, 12)),
      pg_temp.move('3ZflifB',  60, pg_temp.sets(3, 12))
    )),
    ('Pull Day', 'Back and biceps', 3, jsonb_build_array(
      pg_temp.move('lBDjFxJ', 120, pg_temp.sets(3, 8)),
      pg_temp.move('eZyBC3j', 120, pg_temp.sets(4, 8, true)),
      pg_temp.move('LEprlgG',  90, pg_temp.sets(3, 10)),
      pg_temp.move('wqNPGCg',  60, pg_temp.sets(3, 12)),
      pg_temp.move('NbVPDMW',  60, pg_temp.sets(3, 12)),
      pg_temp.move('2NpxjC1',  60, pg_temp.sets(3, 12))
    )),
    ('Leg Day', 'Quads, hamstrings and calves', 4, jsonb_build_array(
      pg_temp.move('iYzB0Cz', 150, pg_temp.sets(4, 6, true)),
      pg_temp.move('wQ2c4XD', 120, pg_temp.sets(3, 8)),
      pg_temp.move('10Z2DXU',  90, pg_temp.sets(3, 10)),
      pg_temp.move('17lJ1kr',  60, pg_temp.sets(3, 12)),
      pg_temp.move('my33uHU',  60, pg_temp.sets(3, 12)),
      pg_temp.move('ykUOVze',  45, pg_temp.sets(4, 15))
    )),
    ('Fat Burn Circuit', 'No waiting for machines', 5, jsonb_build_array(
      pg_temp.move('dK9394r', 30, pg_temp.sets(3, 12)),
      pg_temp.move('UHJlbu3', 30, pg_temp.sets(3, 15)),
      pg_temp.move('yn8yg1r', 30, pg_temp.sets(3, 12)),
      pg_temp.move('I4hDWkc', 30, pg_temp.sets(3, 12)),
      pg_temp.move('RRWFUcw', 30, pg_temp.sets(3, 10)),
      pg_temp.move('I3tsCnC', 30, pg_temp.sets(3, 12))
    ))
  ) as template(name, summary, position, entries)
 where not exists (select 1 from public.routines r where r.owner_id is null and r.name = template.name);
