-- Privilege grants required when auto_expose_new_tables is disabled (default).
-- RLS still restricts which profile rows authenticated users can read/update.

grant usage on schema public to authenticated;

grant select, update on table public.profiles to authenticated;
