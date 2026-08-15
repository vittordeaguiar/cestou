begin;

select plan(13);

select has_table('public', 'price_estimate_locks', 'price estimate lock table exists');
select has_function(
  'public',
  'acquire_price_estimate_lock',
  array['uuid', 'uuid', 'uuid'],
  'lock acquisition function exists'
);
select has_function(
  'public',
  'release_price_estimate_lock',
  array['uuid', 'uuid', 'uuid'],
  'lock release function exists'
);
select has_function(
  'public',
  'finish_price_estimate',
  array['uuid', 'uuid', 'numeric', 'text[]', 'uuid'],
  'atomic estimate persistence function exists'
);

insert into auth.users (id)
values
  ('91000000-0000-0000-0000-000000000001'),
  ('91000000-0000-0000-0000-000000000002');

insert into public.groups (id, name)
values
  ('92000000-0000-0000-0000-000000000001', 'Casa A'),
  ('92000000-0000-0000-0000-000000000002', 'Casa B');

update public.lists
set id = case group_id
  when '92000000-0000-0000-0000-000000000001' then '93000000-0000-0000-0000-000000000001'::uuid
  when '92000000-0000-0000-0000-000000000002' then '93000000-0000-0000-0000-000000000002'::uuid
end
where group_id in (
  '92000000-0000-0000-0000-000000000001',
  '92000000-0000-0000-0000-000000000002'
);

insert into public.group_members (group_id, user_id, role)
values
  (
    '92000000-0000-0000-0000-000000000001',
    '91000000-0000-0000-0000-000000000001',
    'owner'
  ),
  (
    '92000000-0000-0000-0000-000000000002',
    '91000000-0000-0000-0000-000000000002',
    'owner'
  );

set local role service_role;

select ok(
  public.acquire_price_estimate_lock(
    '93000000-0000-0000-0000-000000000001',
    '94000000-0000-0000-0000-000000000001',
    '91000000-0000-0000-0000-000000000001'
  ),
  'a list member acquires the first lock'
);

select is(
  public.acquire_price_estimate_lock(
    '93000000-0000-0000-0000-000000000001',
    '94000000-0000-0000-0000-000000000002',
    '91000000-0000-0000-0000-000000000001'
  ),
  false,
  'a concurrent request cannot replace an active lock'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000001', true);

select is(
  (select count(*)::integer from public.price_estimate_locks),
  0,
  'lock internals are not readable through the authenticated API'
);

select throws_ok(
  $$
    select public.acquire_price_estimate_lock(
      '93000000-0000-0000-0000-000000000001',
      '94000000-0000-0000-0000-000000000005',
      '91000000-0000-0000-0000-000000000001'
    )
  $$,
  '42501',
  null,
  'authenticated clients cannot call the privileged lock function'
);

reset role;
set local role service_role;

select lives_ok(
  $$
    select public.finish_price_estimate(
      '93000000-0000-0000-0000-000000000001',
      '94000000-0000-0000-0000-000000000001',
      42.50,
      array['Leite'],
      '91000000-0000-0000-0000-000000000001'
    )
  $$,
  'the lock holder atomically saves the estimate'
);

reset role;

select is(
  (
    select (total_amount::text || ':' || array_to_string(items_not_found, ','))
    from public.price_estimates
    where list_id = '93000000-0000-0000-0000-000000000001'
  ),
  '42.50:Leite',
  'the current estimate stores the consolidated result'
);

select is(
  (
    select count(*)::integer
    from public.price_estimate_locks
    where list_id = '93000000-0000-0000-0000-000000000001'
  ),
  0,
  'finishing removes the lock'
);

set local role service_role;

select throws_ok(
  $$
    select public.acquire_price_estimate_lock(
      '93000000-0000-0000-0000-000000000001',
      '94000000-0000-0000-0000-000000000003',
      '91000000-0000-0000-0000-000000000002'
    )
  $$,
  '42501',
  'Not authorized to estimate this list',
  'a user outside the group cannot lock the list'
);

reset role;
set local role authenticated;

select throws_ok(
  $$
    insert into public.price_estimate_locks (list_id, lock_token, locked_until)
    values (
      '93000000-0000-0000-0000-000000000002',
      '94000000-0000-0000-0000-000000000004',
      now() + interval '1 hour'
    )
  $$,
  '42501',
  null,
  'authenticated clients cannot bypass the lock function'
);

select * from finish();
rollback;
