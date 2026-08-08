begin;

select plan(6);

insert into auth.users (id)
values
  ('40000000-0000-0000-0000-000000000001'),
  ('40000000-0000-0000-0000-000000000002');

update public.profiles
set display_name = case id
  when '40000000-0000-0000-0000-000000000001' then 'Owner One'
  when '40000000-0000-0000-0000-000000000002' then 'Owner Two'
end
where id in (
  '40000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000002'
);

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"40000000-0000-0000-0000-000000000001","email":"owner1@example.com"}',
  true
);

select lives_ok(
  $$ select public.create_group('  Família Silva  ') $$,
  'authenticated user can create a group'
);

select is(
  (
    select name
    from public.groups
    where id = (
      select group_id
      from public.group_members
      where user_id = '40000000-0000-0000-0000-000000000001'
    )
  ),
  'Família Silva',
  'create_group trims the group name'
);

select is(
  (
    select role::text
    from public.group_members
    where user_id = '40000000-0000-0000-0000-000000000001'
  ),
  'owner',
  'creator becomes the group owner'
);

select is(
  (
    select count(*)::integer
    from public.lists
    where group_id = (
      select group_id
      from public.group_members
      where user_id = '40000000-0000-0000-0000-000000000001'
    )
      and status = 'active'
  ),
  1,
  'creating a group also creates one active shared list'
);

select throws_ok(
  $$ select public.create_group('Segundo grupo') $$,
  'P0001',
  'User already belongs to a group',
  'a user cannot create a second group in v1'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000002', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"40000000-0000-0000-0000-000000000002","email":"owner2@example.com"}',
  true
);

select lives_ok(
  $$ select public.create_group('Outra família') $$,
  'a different user can still create their own group'
);

reset role;
select * from finish();
rollback;
