alter type public.group_member_role rename value 'admin' to 'owner';

create unique index group_members_one_owner_per_group
  on public.group_members (group_id)
  where role = 'owner';

create function public.is_group_member(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.group_members
      where group_id = target_group_id
        and user_id = auth.uid()
    );
$$;

create function public.is_group_owner(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.group_members
      where group_id = target_group_id
        and user_id = auth.uid()
        and role = 'owner'
    );
$$;

create function public.is_only_group_member(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select count(*) = 1
  from public.group_members
  where group_id = target_group_id;
$$;

create function public.is_list_member(target_list_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.lists
    where id = target_list_id
      and public.is_group_member(group_id)
  );
$$;

create function public.shares_group_with(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() = target_user_id
    or (
      auth.uid() is not null
      and exists (
        select 1
        from public.group_members as current_member
        join public.group_members as target_member
          on target_member.group_id = current_member.group_id
        where current_member.user_id = auth.uid()
          and target_member.user_id = target_user_id
      )
    );
$$;

create function public.create_group(group_name text)
returns public.groups
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  created_group public.groups;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  insert into public.groups (name)
  values (group_name)
  returning * into created_group;

  insert into public.group_members (group_id, user_id, role)
  values (created_group.id, current_user_id, 'owner');

  return created_group;
end;
$$;

create function public.create_group_invite(
  target_group_id uuid,
  invited_email text,
  invitation_expires_at timestamptz
)
returns public.group_invites
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_invite public.group_invites;
begin
  if not public.is_group_owner(target_group_id) then
    raise exception 'Only group owners can create invitations' using errcode = '42501';
  end if;

  if invitation_expires_at <= now() then
    raise exception 'Invitation expiration must be in the future' using errcode = '22023';
  end if;

  insert into public.group_invites (group_id, email, invited_by, expires_at)
  values (target_group_id, lower(btrim(invited_email)), auth.uid(), invitation_expires_at)
  returning * into created_invite;

  return created_invite;
end;
$$;

create function public.cancel_group_invite(target_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.group_invites
  set status = 'revoked'
  where id = target_invite_id
    and status = 'pending'
    and public.is_group_owner(group_id);

  if not found then
    raise exception 'Pending invitation not found or not permitted' using errcode = '42501';
  end if;
end;
$$;

create function public.accept_group_invite(target_invite_id uuid)
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

create function public.transfer_group_ownership(target_group_id uuid, target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if not public.is_group_owner(target_group_id) then
    raise exception 'Only the current owner can transfer ownership' using errcode = '42501';
  end if;

  if target_user_id = current_user_id then
    raise exception 'Ownership must be transferred to another member' using errcode = '22023';
  end if;

  perform 1
  from public.group_members
  where group_id = target_group_id
    and user_id = target_user_id
  for update;

  if not found then
    raise exception 'New owner must already be a group member' using errcode = '22023';
  end if;

  update public.group_members
  set role = 'member'
  where group_id = target_group_id
    and user_id = current_user_id;

  update public.group_members
  set role = 'owner'
  where group_id = target_group_id
    and user_id = target_user_id;
end;
$$;

create function public.prevent_list_item_created_by_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.created_by is distinct from old.created_by then
    raise exception 'list_items.created_by is immutable' using errcode = '22000';
  end if;

  return new;
end;
$$;

create trigger list_items_prevent_created_by_change
before update on public.list_items
for each row execute function public.prevent_list_item_created_by_change();

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_invites enable row level security;
alter table public.lists enable row level security;
alter table public.list_items enable row level security;
alter table public.price_estimates enable row level security;

create policy profiles_select_shared_groups on public.profiles
for select to authenticated
using (public.shares_group_with(id));

create policy profiles_insert_self on public.profiles
for insert to authenticated
with check (auth.uid() = id);

create policy profiles_update_self on public.profiles
for update to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create policy groups_select_members on public.groups
for select to authenticated
using (public.is_group_member(id));

create policy groups_update_owner on public.groups
for update to authenticated
using (public.is_group_owner(id))
with check (public.is_group_owner(id));

create policy groups_delete_lone_owner on public.groups
for delete to authenticated
using (public.is_group_owner(id) and public.is_only_group_member(id));

create policy group_members_select_members on public.group_members
for select to authenticated
using (public.is_group_member(group_id));

create policy group_members_delete_self_or_owner on public.group_members
for delete to authenticated
using (
  (auth.uid() = user_id and role = 'member')
  or (public.is_group_owner(group_id) and user_id <> auth.uid())
);

create policy group_invites_select_owner_or_recipient on public.group_invites
for select to authenticated
using (
  public.is_group_owner(group_id)
  or lower(btrim(email)) = lower(btrim(coalesce(auth.jwt() ->> 'email', '')))
);

create policy lists_select_members on public.lists
for select to authenticated
using (public.is_group_member(group_id));

create policy list_items_select_members on public.list_items
for select to authenticated
using (public.is_list_member(list_id));

create policy list_items_insert_members on public.list_items
for insert to authenticated
with check (
  public.is_list_member(list_id)
  and (created_by is null or created_by = auth.uid())
);

create policy list_items_update_members on public.list_items
for update to authenticated
using (public.is_list_member(list_id))
with check (public.is_list_member(list_id));

create policy list_items_delete_members on public.list_items
for delete to authenticated
using (public.is_list_member(list_id));

create policy price_estimates_select_members on public.price_estimates
for select to authenticated
using (public.is_list_member(list_id));

revoke all on function public.is_group_member(uuid) from public;
revoke all on function public.is_group_owner(uuid) from public;
revoke all on function public.is_only_group_member(uuid) from public;
revoke all on function public.is_list_member(uuid) from public;
revoke all on function public.shares_group_with(uuid) from public;
revoke all on function public.create_group(text) from public;
revoke all on function public.create_group_invite(uuid, text, timestamptz) from public;
revoke all on function public.cancel_group_invite(uuid) from public;
revoke all on function public.accept_group_invite(uuid) from public;
revoke all on function public.transfer_group_ownership(uuid, uuid) from public;
revoke all on function public.prevent_list_item_created_by_change() from public;

grant execute on function public.is_group_member(uuid) to authenticated;
grant execute on function public.is_group_owner(uuid) to authenticated;
grant execute on function public.is_only_group_member(uuid) to authenticated;
grant execute on function public.is_list_member(uuid) to authenticated;
grant execute on function public.shares_group_with(uuid) to authenticated;
grant execute on function public.create_group(text) to authenticated;
grant execute on function public.create_group_invite(uuid, text, timestamptz) to authenticated;
grant execute on function public.cancel_group_invite(uuid) to authenticated;
grant execute on function public.accept_group_invite(uuid) to authenticated;
grant execute on function public.transfer_group_ownership(uuid, uuid) to authenticated;
