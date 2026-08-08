-- Reconcile any pre-v1 multi-group memberships before enforcing one group per user.
-- Preference per user: keep an owner membership when present, otherwise the oldest row.
create temporary table _cestou_duplicate_memberships on commit drop as
select
  id,
  group_id,
  user_id,
  role,
  row_number() over (
    partition by user_id
    order by
      case when role = 'owner' then 0 else 1 end,
      created_at asc,
      id asc
  ) as keep_rank
from public.group_members;

create temporary table _cestou_memberships_to_drop on commit drop as
select id, group_id, role
from _cestou_duplicate_memberships
where keep_rank > 1;

-- Groups that would lose their owner because that ownership is a discarded duplicate.
create temporary table _cestou_groups_losing_owner on commit drop as
select distinct group_id
from _cestou_memberships_to_drop
where role = 'owner';

-- Promote the oldest remaining member so those groups keep exactly one owner.
with candidates as (
  select
    gm.id as membership_id,
    gm.group_id,
    row_number() over (
      partition by gm.group_id
      order by gm.created_at asc, gm.id asc
    ) as member_rank
  from public.group_members as gm
  join _cestou_groups_losing_owner as losing
    on losing.group_id = gm.group_id
  where not exists (
    select 1
    from _cestou_memberships_to_drop as dropping
    where dropping.id = gm.id
  )
)
update public.group_members as gm
set role = 'owner'
from candidates as c
where gm.id = c.membership_id
  and c.member_rank = 1
  and gm.role is distinct from 'owner';

delete from public.group_members as gm
using _cestou_memberships_to_drop as dropping
where gm.id = dropping.id;

-- Remove groups left without members after reconciliation.
delete from public.groups as g
where not exists (
  select 1
  from public.group_members as gm
  where gm.group_id = g.id
);

-- Truncate oversized names before the length constraint (legacy rows only).
update public.groups
set name = left(btrim(name), 80)
where char_length(btrim(name)) > 80;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'groups_name_max_length'
      and conrelid = 'public.groups'::regclass
  ) then
    alter table public.groups
      add constraint groups_name_max_length
      check (char_length(name) <= 80);
  end if;
end;
$$;

comment on constraint groups_name_max_length on public.groups is
  'Matches the application/RPC max length for group names (80).';

-- Safe if 20260808140000 already created the index, or if it failed before doing so.
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

  if char_length(normalized_name) > 80 then
    raise exception 'Group name must be at most 80 characters' using errcode = '22023';
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
  'Creates a group, makes the caller the owner, and relies on groups_create_initial_list for the shared list. Enforces trimmed non-empty names (<= 80 chars) and one group membership per user in v1.';

revoke all on function public.create_group(text) from public;
grant execute on function public.create_group(text) to authenticated;
