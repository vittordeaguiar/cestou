begin;

select plan(5);

insert into auth.users (id, raw_user_meta_data)
values (
  '60000000-0000-0000-0000-000000000001',
  '{"display_name":"  Ana   Maria  "}'::jsonb
);

select is(
  (
    select display_name
    from public.profiles
    where id = '60000000-0000-0000-0000-000000000001'
  ),
  'Ana Maria',
  'creating an Auth user creates a normalized profile'
);

insert into auth.users (id)
values ('60000000-0000-0000-0000-000000000002');

set local role authenticated;
select set_config('request.jwt.claim.sub', '60000000-0000-0000-0000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"60000000-0000-0000-0000-000000000001","email":"ana@example.com"}',
  true
);

select is(
  (
    select display_name
    from public.profiles
    where id = '60000000-0000-0000-0000-000000000001'
  ),
  'Ana Maria',
  'a user can read their own profile'
);

select is(
  (
    with changed as (
      update public.profiles
      set display_name = 'Ana Souza'
      where id = '60000000-0000-0000-0000-000000000001'
      returning display_name
    )
    select display_name from changed
  ),
  'Ana Souza',
  'a user can update their own profile name'
);

select is(
  (
    with changed as (
      update public.profiles
      set display_name = 'Tentativa inválida'
      where id = '60000000-0000-0000-0000-000000000002'
      returning 1
    )
    select count(*)::integer from changed
  ),
  0,
  'a user cannot update another profile'
);

select is(
  (
    select count(*)::integer
    from public.profiles
    where id = '60000000-0000-0000-0000-000000000002'
  ),
  0,
  'a user cannot read a profile that is not their own or shared'
);

reset role;
select * from finish();
rollback;
