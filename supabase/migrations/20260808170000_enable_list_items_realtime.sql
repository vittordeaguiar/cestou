-- Enable Supabase Realtime postgres_changes for shared list items.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'list_items'
  ) then
    alter publication supabase_realtime add table public.list_items;
  end if;
end
$$;
