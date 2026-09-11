insert into branches (name, address, phone)
select 'Main Branch', 'Ijaye, Lagos', '07050417291'
where not exists (select 1 from branches);

insert into plans (name, price, duration_days, counts_for_referral, is_addon, sort_order) values
  ('Walk In',            2000,   1, false, false, 1),
  ('2 Weeks',           10000,  14, false, false, 2),
  ('1 Month',           20000,  30, true,  false, 3),
  ('3 Months',          50000,  90, true,  false, 4),
  ('6 Months',         100000, 180, true,  false, 5),
  ('1 Year',           180000, 365, true,  false, 6),
  ('Personal Trainer',  15000,   0, false, true,  7)
on conflict do nothing;

update settings set registration_fee = 5000, referral_target = 3,
  referral_reward_days = 7, expiry_notice_days = 5, checkin_window_hours = 24,
  gym_name = 'Zenthos Gym' where id;
