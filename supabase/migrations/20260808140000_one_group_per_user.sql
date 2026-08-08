-- v1 product rule: a user may belong to at most one group.
create unique index if not exists group_members_one_group_per_user
  on public.group_members (user_id);

comment on index public.group_members_one_group_per_user is
  'Temporary v1 rule: each user may participate in only one group.';

create or replace function public.create_group(group_name text)
returns public.groups
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_name text := nullif(btrim(group_name), '');
  created_group public.groups;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if normalized_name is null then
    raise exception 'Group name is required' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.group_members
    where user_id = current_user_id
  ) then
    raise exception 'User already belongs to a group' using errcode = 'P0001';
  end if;

  insert into public.groups (name)
  values (normalized_name)
  returning * into created_group;

  insert into public.group_members (group_id, user_id, role)
  values (created_group.id, current_user_id, 'owner');

  return created_group;
end;
$$;

comment on function public.create_group(text) is
  'Creates a group, makes the caller the owner, and relies on groups_create_initial_list for the shared list. Enforces one group membership per user in v1.';

create or replace function public.accept_group_invite(target_invite_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_email text := lower(btrim(coalesce(auth.jwt() ->> 'email', '')));
  invitation public.group_invites;
begin
  if current_user_id is null or current_email = '' then
    raise exception 'Authentication with an email claim is required' using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.group_members
    where user_id = current_user_id
  ) then
    raise exception 'User already belongs to a group' using errcode = 'P0001';
  end if;

  select *
  into invitation
  from public.group_invites
  where id = target_invite_id
  for update;

  if not found
    or invitation.status <> 'pending'
    or invitation.expires_at <= now()
    or lower(btrim(invitation.email)) <> current_email
  then
    raise exception 'Invitation is not available for this user' using errcode = '42501';
  end if;

  insert into public.group_members (group_id, user_id, role)
  values (invitation.group_id, current_user_id, 'member')
  on conflict (group_id, user_id) do nothing;

  update public.group_invites
  set status = 'accepted', accepted_at = now()
  where id = invitation.id;

  return invitation.group_id;
end;
$$;

comment on function public.accept_group_invite(uuid) is
  'Accepts a pending invitation for the authenticated email. Rejects users who already belong to a group in v1.';

revoke all on function public.create_group(text) from public;
revoke all on function public.accept_group_invite(uuid) from public;
grant execute on function public.create_group(text) to authenticated;
grant execute on function public.accept_group_invite(uuid) to authenticated;
