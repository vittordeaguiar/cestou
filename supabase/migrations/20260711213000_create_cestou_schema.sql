create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create type public.group_member_role as enum ('admin', 'member');
create type public.group_invite_status as enum (
  'pending',
  'accepted',
  'revoked',
  'expired'
);
create type public.list_status as enum ('active', 'archived');
create type public.item_category as enum ('mercado', 'farmacia', 'outro');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_not_blank
    check (display_name is null or btrim(display_name) <> '')
);

comment on table public.profiles is
  'Public application profile extending Supabase Auth users.';

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint groups_name_not_blank check (btrim(name) <> '')
);

comment on table public.groups is
  'Shopping group. Administrative ownership is represented only by group_members.role.';

create table public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.group_member_role not null default 'member',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint group_members_group_user_unique unique (group_id, user_id)
);

comment on column public.group_members.role is
  'Single source of truth for group administration; groups intentionally has no owner_id.';

create table public.group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  email text not null,
  invited_by uuid references public.profiles (id) on delete set null,
  status public.group_invite_status not null default 'pending',
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint group_invites_email_not_blank check (btrim(email) <> ''),
  constraint group_invites_expiration_after_creation check (expires_at > created_at),
  constraint group_invites_acceptance_consistent check (
    (status = 'accepted' and accepted_at is not null)
    or (status <> 'accepted' and accepted_at is null)
  )
);

comment on table public.group_invites is
  'Email invitations. A partial unique index allows only one pending invitation per group/email.';

create table public.lists (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  status public.list_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.lists is
  'Shared shopping lists. Exactly one active list is maintained for every existing group.';

create table public.list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists (id) on delete cascade,
  name text not null,
  quantity numeric(12, 3) not null default 1,
  category public.item_category,
  purchased boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint list_items_name_not_blank check (btrim(name) <> ''),
  constraint list_items_quantity_positive check (quantity > 0)
);

comment on column public.list_items.category is
  'Optional v1 tag controlled by item_category; null means uncategorized.';

create table public.price_estimates (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists (id) on delete cascade,
  total_amount numeric(12, 2) not null,
  items_not_found text[] not null default '{}',
  created_by uuid references public.profiles (id) on delete set null,
  calculated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint price_estimates_list_unique unique (list_id),
  constraint price_estimates_total_nonnegative check (total_amount >= 0),
  constraint price_estimates_items_not_found_one_dimension
    check (array_ndims(items_not_found) is null or array_ndims(items_not_found) = 1)
);

comment on table public.price_estimates is
  'Current estimate per list. The unique list_id intentionally avoids a complete estimate/price history in v1.';

create unique index group_invites_one_pending_per_email
  on public.group_invites (group_id, lower(btrim(email)))
  where status = 'pending';

create unique index lists_one_active_per_group
  on public.lists (group_id)
  where status = 'active';

create index group_members_user_id_idx on public.group_members (user_id);
create index group_invites_group_id_idx on public.group_invites (group_id);
create index group_invites_invited_by_idx on public.group_invites (invited_by);
create index group_invites_pending_email_idx
  on public.group_invites (lower(btrim(email)))
  where status = 'pending';
create index lists_group_id_idx on public.lists (group_id);
create index list_items_list_purchased_created_idx
  on public.list_items (list_id, purchased, created_at);
create index list_items_created_by_idx on public.list_items (created_by);
create index price_estimates_created_by_idx on public.price_estimates (created_by);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger groups_set_updated_at
before update on public.groups
for each row execute function public.set_updated_at();

create trigger group_members_set_updated_at
before update on public.group_members
for each row execute function public.set_updated_at();

create trigger group_invites_set_updated_at
before update on public.group_invites
for each row execute function public.set_updated_at();

create trigger lists_set_updated_at
before update on public.lists
for each row execute function public.set_updated_at();

create trigger list_items_set_updated_at
before update on public.list_items
for each row execute function public.set_updated_at();

create trigger price_estimates_set_updated_at
before update on public.price_estimates
for each row execute function public.set_updated_at();

revoke execute on function public.set_updated_at() from public;

create function public.create_initial_group_list()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.lists (group_id, status)
  values (new.id, 'active');
  return new;
end;
$$;

comment on function public.create_initial_group_list() is
  'Creates the required shared active list. SECURITY DEFINER keeps the invariant compatible with future RLS.';

revoke execute on function public.create_initial_group_list() from public;

create trigger groups_create_initial_list
after insert on public.groups
for each row execute function public.create_initial_group_list();

create function public.ensure_group_has_active_list()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_group_id uuid;
begin
  affected_group_id := coalesce(new.group_id, old.group_id);

  if exists (
    select 1 from public.groups where id = affected_group_id
  ) and not exists (
    select 1
    from public.lists
    where group_id = affected_group_id and status = 'active'
  ) then
    raise exception 'group % must have one active list', affected_group_id
      using errcode = '23514';
  end if;

  if tg_op = 'UPDATE'
    and old.group_id is distinct from new.group_id
    and exists (
      select 1 from public.groups where id = old.group_id
    )
    and not exists (
      select 1
      from public.lists
      where group_id = old.group_id and status = 'active'
    )
  then
    raise exception 'group % must have one active list', old.group_id
      using errcode = '23514';
  end if;

  return null;
end;
$$;

comment on function public.ensure_group_has_active_list() is
  'Deferred invariant check allowing an active-list replacement within one transaction.';

revoke execute on function public.ensure_group_has_active_list() from public;

create constraint trigger lists_require_active_list
after delete or update of group_id, status on public.lists
deferrable initially deferred
for each row execute function public.ensure_group_has_active_list();
