-- Privilege grants required when auto_expose_new_tables is disabled (default).
-- Mirrors the profiles grants: without table-level privileges the authenticated
-- role cannot reach these tables through PostgREST even when RLS would allow the
-- row. RLS policies still restrict which rows each user can read/write.

grant select on table public.groups to authenticated;
grant select, delete on table public.group_members to authenticated;
grant select on table public.group_invites to authenticated;
grant select on table public.lists to authenticated;
grant select, insert, update, delete on table public.list_items to authenticated;
