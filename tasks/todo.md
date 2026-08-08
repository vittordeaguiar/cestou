# V-45 — Fluxo de criação de grupo/família

## Plano

- [x] Auditar schema, RPC `create_group`, RLS e padrões de auth/UI.
- [x] Migration: um grupo por usuário + RPC atualizada (create/accept).
- [x] Validação, action SSR, formulário e rotas `/app`, `/app/groups/new`, lista stub.
- [x] Testes unitários/componentes + teste SQL de criação.
- [x] Lint, typecheck, Vitest, format e PR.

## Notas

- Lista compartilhada já nasce no trigger `groups_create_initial_list`.
- Papel do criador: `owner` (enum já renomeado de `admin` na V-40).
- Itens da lista e convites ficam fora do escopo desta issue.
