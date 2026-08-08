begin;

select plan(3);

insert into public.groups (id, name)
values ('50000000-0000-0000-0000-000000000001', 'Lista teste unidade');

select has_column('public', 'list_items', 'unit', 'list_items.unit column exists');

select throws_ok(
  $$
    insert into public.list_items (list_id, name, unit)
    values (
      (
        select id
        from public.lists
        where group_id = '50000000-0000-0000-0000-000000000001'
      ),
      'Item sem unidade válida',
      '   '
    )
  $$,
  '23514',
  null,
  'list_items.unit cannot be blank'
);

select throws_ok(
  $$
    insert into public.list_items (list_id, name, unit)
    values (
      (
        select id
        from public.lists
        where group_id = '50000000-0000-0000-0000-000000000001'
      ),
      'Item unidade longa',
      repeat('u', 21)
    )
  $$,
  '23514',
  null,
  'list_items.unit cannot exceed 20 characters'
);

select * from finish();
rollback;
