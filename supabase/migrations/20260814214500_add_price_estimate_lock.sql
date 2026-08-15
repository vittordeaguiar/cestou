create table public.price_estimate_locks (
  list_id uuid primary key references public.lists (id) on delete cascade,
  lock_token uuid not null,
  locked_until timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.price_estimate_locks is
  'Short-lived distributed locks that prevent concurrent price estimates for the same list.';

create trigger price_estimate_locks_set_updated_at
before update on public.price_estimate_locks
for each row execute function public.set_updated_at();

alter table public.price_estimate_locks enable row level security;

revoke all on table public.price_estimate_locks from public, anon, authenticated;

create function public.acquire_price_estimate_lock(
  target_list_id uuid,
  lock_token uuid,
  requested_by uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  acquired boolean;
begin
  if not exists (
    select 1
    from public.lists
    join public.group_members
      on group_members.group_id = lists.group_id
    where lists.id = target_list_id
      and group_members.user_id = requested_by
  ) then
    raise exception 'Not authorized to estimate this list' using errcode = '42501';
  end if;

  insert into public.price_estimate_locks (list_id, lock_token, locked_until)
  values (target_list_id, lock_token, statement_timestamp() + interval '3 minutes')
  on conflict (list_id) do update
  set
    lock_token = excluded.lock_token,
    locked_until = excluded.locked_until
  where public.price_estimate_locks.locked_until <= statement_timestamp()
  returning true into acquired;

  return coalesce(acquired, false);
end;
$$;

create function public.release_price_estimate_lock(
  target_list_id uuid,
  lock_token uuid,
  requested_by uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.lists
    join public.group_members
      on group_members.group_id = lists.group_id
    where lists.id = target_list_id
      and group_members.user_id = requested_by
  ) then
    raise exception 'Not authorized to estimate this list' using errcode = '42501';
  end if;

  delete from public.price_estimate_locks
  where list_id = target_list_id
    and price_estimate_locks.lock_token = release_price_estimate_lock.lock_token;
end;
$$;

create function public.finish_price_estimate(
  target_list_id uuid,
  lock_token uuid,
  estimated_total numeric,
  missing_items text[],
  requested_by uuid
)
returns public.price_estimates
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_estimate public.price_estimates;
begin
  if not exists (
    select 1
    from public.lists
    join public.group_members
      on group_members.group_id = lists.group_id
    where lists.id = target_list_id
      and group_members.user_id = requested_by
  ) then
    raise exception 'Not authorized to estimate this list' using errcode = '42501';
  end if;

  perform 1
  from public.price_estimate_locks
  where list_id = target_list_id
    and price_estimate_locks.lock_token = finish_price_estimate.lock_token
    and locked_until > statement_timestamp()
  for update;

  if not found then
    raise exception 'Price estimate lock expired' using errcode = 'P0001';
  end if;

  insert into public.price_estimates (
    list_id,
    total_amount,
    items_not_found,
    created_by,
    calculated_at
  )
  values (
    target_list_id,
    estimated_total,
    coalesce(missing_items, '{}'),
    requested_by,
    statement_timestamp()
  )
  on conflict (list_id) do update
  set
    total_amount = excluded.total_amount,
    items_not_found = excluded.items_not_found,
    created_by = excluded.created_by,
    calculated_at = excluded.calculated_at
  returning * into saved_estimate;

  delete from public.price_estimate_locks
  where list_id = target_list_id
    and price_estimate_locks.lock_token = finish_price_estimate.lock_token;

  return saved_estimate;
end;
$$;

revoke all on function public.acquire_price_estimate_lock(uuid, uuid, uuid) from public;
revoke all on function public.release_price_estimate_lock(uuid, uuid, uuid) from public;
revoke all on function public.finish_price_estimate(uuid, uuid, numeric, text[], uuid) from public;

grant execute on function public.acquire_price_estimate_lock(uuid, uuid, uuid) to service_role;
grant execute on function public.release_price_estimate_lock(uuid, uuid, uuid) to service_role;
grant execute on function public.finish_price_estimate(uuid, uuid, numeric, text[], uuid) to service_role;
