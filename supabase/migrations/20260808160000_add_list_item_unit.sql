-- Optional free-text unit for list items (e.g. kg, un, pct).
alter table public.list_items
  add column unit text;

alter table public.list_items
  add constraint list_items_unit_not_blank
  check (unit is null or btrim(unit) <> '');

alter table public.list_items
  add constraint list_items_unit_max_length
  check (unit is null or char_length(unit) <= 20);

comment on column public.list_items.unit is
  'Optional free-text quantity unit shown next to quantity; null means unspecified.';
