begin;

select plan(17);

select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'groups', 'groups table exists');
select has_table('public', 'group_members', 'group_members table exists');
select has_table('public', 'group_invites', 'group_invites table exists');
select has_table('public', 'lists', 'lists table exists');
select has_table('public', 'list_items', 'list_items table exists');
select has_table('public', 'price_estimates', 'price_estimates table exists');

insert into public.groups (id, name)
values ('10000000-0000-0000-0000-000000000001', 'Casa');

select is(
  (
    select count(*)::integer
    from public.lists
    where group_id = '10000000-0000-0000-0000-000000000001'
      and status = 'active'
  ),
  1,
  'creating a group creates exactly one active list'
);

select throws_ok(
  $$
    insert into public.lists (group_id, status)
    values ('10000000-0000-0000-0000-000000000001', 'active')
  $$,
  '23505',
  null,
  'a group cannot have two active lists'
);

set constraints lists_require_active_list immediate;

select throws_ok(
  $$
    update public.lists
    set status = 'archived'
    where group_id = '10000000-0000-0000-0000-000000000001'
  $$,
  '23514',
  null,
  'a group cannot lose its only active list'
);

insert into auth.users (id)
values ('20000000-0000-0000-0000-000000000001');

insert into public.profiles (id, display_name)
values ('20000000-0000-0000-0000-000000000001', 'Pessoa');

insert into public.group_members (group_id, user_id, role)
values (
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  'owner'
);

select throws_ok(
  $$
    insert into public.group_members (group_id, user_id)
    values (
      '10000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001'
    )
  $$,
  '23505',
  null,
  'a user can be a member of a group only once'
);

select throws_ok(
  format(
    'insert into public.list_items (list_id, name, quantity) values (%L, %L, 0)',
    (
      select id
      from public.lists
      where group_id = '10000000-0000-0000-0000-000000000001'
    ),
    'Arroz'
  ),
  '23514',
  null,
  'item quantity must be greater than zero'
);

select lives_ok(
  format(
    'insert into public.list_items (list_id, name, category) values (%L, %L, %L)',
    (
      select id
      from public.lists
      where group_id = '10000000-0000-0000-0000-000000000001'
    ),
    'Curativo',
    'farmacia'
  ),
  'a controlled optional category is accepted'
);

insert into public.group_invites (group_id, email, expires_at)
values (
  '10000000-0000-0000-0000-000000000001',
  'person@example.com',
  now() + interval '7 days'
);

select throws_ok(
  $$
    insert into public.group_invites (group_id, email, expires_at)
    values (
      '10000000-0000-0000-0000-000000000001',
      ' PERSON@example.com ',
      now() + interval '7 days'
    )
  $$,
  '23505',
  null,
  'pending invitations are unique per normalized group/email'
);

select throws_ok(
  format(
    'insert into public.price_estimates (list_id, total_amount) values (%L, -0.01)',
    (
      select id
      from public.lists
      where group_id = '10000000-0000-0000-0000-000000000001'
    )
  ),
  '23514',
  null,
  'estimate total cannot be negative'
);

insert into public.price_estimates (list_id, total_amount, items_not_found)
select id, 25.50, array['Leite']
from public.lists
where group_id = '10000000-0000-0000-0000-000000000001';

select throws_ok(
  format(
    'insert into public.price_estimates (list_id, total_amount) values (%L, 30)',
    (
      select id
      from public.lists
      where group_id = '10000000-0000-0000-0000-000000000001'
    )
  ),
  '23505',
  null,
  'a list stores only its current estimate'
);

delete from public.groups
where id = '10000000-0000-0000-0000-000000000001';

select is(
  (
    select count(*)::integer
    from public.lists
    where group_id = '10000000-0000-0000-0000-000000000001'
  ),
  0,
  'deleting a group cascades to its lists'
);

select * from finish();
rollback;
