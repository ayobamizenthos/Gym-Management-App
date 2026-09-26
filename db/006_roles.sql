update profiles p set role='admin', branch_id=(select id from branches limit 1)
  from auth.users u where u.id=p.id and u.email='admin@zenthosgym.com';
update profiles p set role='receptionist', branch_id=(select id from branches limit 1)
  from auth.users u where u.id=p.id and u.email='receptionist@zenthosgym.com';
update profiles p set branch_id=(select id from branches limit 1)
  from auth.users u where u.id=p.id and u.email='member@zenthosgym.com';
