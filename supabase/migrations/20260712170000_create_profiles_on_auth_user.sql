create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    nullif(
      btrim(
        regexp_replace(
          coalesce(new.raw_user_meta_data ->> 'display_name', ''),
          '[[:space:]]+',
          ' ',
          'g'
        )
      ),
      ''
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Creates the public profile atomically when Supabase Auth creates a user.';

revoke execute on function public.handle_new_user() from public;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
