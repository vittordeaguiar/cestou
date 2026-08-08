-- Enable Supabase Realtime postgres_changes for shared list items.
alter publication supabase_realtime add table public.list_items;
