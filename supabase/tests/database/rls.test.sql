begin;

select plan(21);

insert into auth.users (id)
values
  ('10000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-000000000003'),
  ('10000000-0000-0000-0000-000000000004'),
  ('10000000-0000-0000-0000-000000000005');

update public.profiles
set display_name = case id
  when '10000000-0000-0000-0000-000000000001' then 'A'
  when '10000000-0000-0000-0000-000000000002' then 'B'
  when '10000000-0000-0000-0000-000000000003' then 'C'
  when '10000000-0000-0000-0000-000000000004' then 'D'
  when '10000000-0000-0000-0000-000000000005' then 'E'
end
where id in (
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000004',
  '10000000-0000-0000-0000-000000000005'
);

insert into public.groups (id, name)
values
  ('20000000-0000-0000-0000-000000000001', 'Grupo A'),
  ('20000000-0000-0000-0000-000000000002', 'Grupo C');

update public.lists
set id = case group_id
  when '20000000-0000-0000-0000-000000000001' then '30000000-0000-0000-0000-000000000011'::uuid
  when '20000000-0000-0000-0000-000000000002' then '30000000-0000-0000-0000-000000000012'::uuid
end
where group_id in (
  '20000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000002'
);

insert into public.group_members (group_id, user_id, role)
values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'owner'),
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'member'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003', 'owner');

insert into public.list_items (id, list_id, name, created_by)
values (
  '30000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000011',
  'Arroz',
  '10000000-0000-0000-0000-000000000001'
);

insert into public.price_estimates (list_id, total_amount)
values ('30000000-0000-0000-0000-000000000011', 50);

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000003","email":"c@example.com"}',
  true
);

select is((select count(*)::integer from public.groups), 1, 'C only reads its own group');
select is((select count(*)::integer from public.list_items), 0, 'C cannot read items from Group A');
select is((select count(*)::integer from public.profiles where id = '10000000-0000-0000-0000-000000000001'), 0, 'C cannot read profiles outside its group');
select is(
  (
    with changed as (
      update public.list_items
      set name = 'Tentativa de C'
      where id = '30000000-0000-0000-0000-000000000001'
      returning 1
    )
    select count(*)::integer from changed
  ),
  0,
  'C cannot update an item from Group A'
);
select throws_ok(
  $$
    insert into public.list_items (list_id, name)
    values ('30000000-0000-0000-0000-000000000011', 'Tentativa de C')
  $$,
  '42501',
  null,
  'direct API-style insert into another group is blocked'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","email":"b@example.com"}',
  true
);

select is(
  (
    with changed as (
      update public.list_items
      set name = 'Arroz integral'
      where id = '30000000-0000-0000-0000-000000000001'
      returning 1
    )
    select count(*)::integer from changed
  ),
  1,
  'B can edit a shared item'
);
select is(
  (
    with deleted as (
      delete from public.group_members
      where group_id = '20000000-0000-0000-0000-000000000001'
        and user_id = '10000000-0000-0000-0000-000000000001'
      returning 1
    )
    select count(*)::integer from deleted
  ),
  0,
  'B cannot remove the owner'
);
select is((select count(*)::integer from public.price_estimates), 1, 'B can read group estimates');
select is(
  (
    with changed as (
      update public.price_estimates
      set total_amount = 1
      returning 1
    )
    select count(*)::integer from changed
  ),
  0,
  'B cannot write an estimate from the client'
);
select throws_ok(
  $$
    update public.list_items
    set list_id = '30000000-0000-0000-0000-000000000012'
    where id = '30000000-0000-0000-0000-000000000001'
  $$,
  '22000',
  'list_items.list_id is immutable',
  'B cannot cross groups by changing list_id'
);
select is(
  (
    with deleted as (
      delete from public.group_members
      where group_id = '20000000-0000-0000-0000-000000000001'
        and user_id = '10000000-0000-0000-0000-000000000002'
      returning 1
    )
    select count(*)::integer from deleted
  ),
  1,
  'B can leave its group'
);

reset role;
insert into public.group_members (group_id, user_id, role)
values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'member');

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","email":"a@example.com"}',
  true
);

select is(
  (
    with deleted as (
      delete from public.group_members
      where group_id = '20000000-0000-0000-0000-000000000001'
        and user_id = '10000000-0000-0000-0000-000000000002'
      returning 1
    )
    select count(*)::integer from deleted
  ),
  1,
  'A can remove B from its group'
);
select is(
  (
    with deleted as (
      delete from public.group_members
      where group_id = '20000000-0000-0000-0000-000000000002'
        and user_id = '10000000-0000-0000-0000-000000000003'
      returning 1
    )
    select count(*)::integer from deleted
  ),
  0,
  'A cannot remove members of another group'
);
select is(
  (
    with deleted as (
      delete from public.group_members
      where group_id = '20000000-0000-0000-0000-000000000001'
        and user_id = '10000000-0000-0000-0000-000000000001'
      returning 1
    )
    select count(*)::integer from deleted
  ),
  0,
  'A cannot leave while it is the owner'
);

select lives_ok(
  $$ select public.create_group_invite('20000000-0000-0000-0000-000000000001', 'e@example.com', now() + interval '1 day') $$,
  'A can create an invitation through the RPC'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000005', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000005","email":"e@example.com"}',
  true
);

select lives_ok(
  $$
    select public.accept_group_invite(id)
    from public.group_invites
    where group_id = '20000000-0000-0000-0000-000000000001'
      and email = 'e@example.com'
  $$,
  'E can accept only its matching invitation through the RPC'
);
select ok(
  exists (
    select 1 from public.group_members
    where group_id = '20000000-0000-0000-0000-000000000001'
      and user_id = '10000000-0000-0000-0000-000000000005'
  ),
  'accepting an invitation creates a member role'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","email":"a@example.com"}',
  true
);

select lives_ok(
  $$ select public.transfer_group_ownership('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005') $$,
  'A can transfer ownership to an existing member'
);

reset role;
select is(
  (
    select role::text
    from public.group_members
    where group_id = '20000000-0000-0000-0000-000000000001'
      and user_id = '10000000-0000-0000-0000-000000000005'
  ),
  'owner',
  'ownership transfer promotes the selected member'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000004', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000004","email":"d@example.com"}',
  true
);

select is((select count(*)::integer from public.groups), 0, 'a user without a group cannot access group data');
select is((select count(*)::integer from public.list_items), 0, 'a user without a group cannot access items');

reset role;
select * from finish();
rollback;
