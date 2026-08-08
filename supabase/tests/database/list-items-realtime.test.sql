begin;

select plan(1);

select ok(
  exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'list_items'
  ),
  'list_items is in the supabase_realtime publication'
);

select * from finish();

rollback;
