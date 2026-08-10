# V-51 — Tag opcional de categoria por item

## Plano

- [x] Branch `cursor/v-51-item-category-tag-9bc8`.
- [x] Wire `category` through row/selects/validation/sync (no migration).
- [x] Persist on create/update actions.
- [x] Selector + badge + client filter in list panel.
- [x] Tests, README, commit/push e PR.

## Notas

- Enum/coluna já existiam no schema (`mercado` | `farmacia` | `outro`, nullable).
- Filtro é apenas visual; pending/Comprados permanecem a estrutura principal.
