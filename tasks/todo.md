# V-47 — Tela de gerenciamento de membros do grupo

## Plano

- [x] Atualizar a partir de `main` e criar branch `cursor/v-47-group-members-management-c025`.
- [x] Helpers de listagem + actions remove/leave alinhadas ao RLS.
- [x] Página `/members`, painel com Dialog, link na lista, README.
- [x] Testes, checks sequenciais, commit/push e PR.
- [x] Fixes P1/P2: reconciliar memberships duplicadas antes do índice único; limite de 80 chars na RPC/`groups`.

## Notas

- Sem migration nova para membros: policies de `group_members` / `group_invites` já cobrem o escopo.
- Criar/cancelar convites e transferir ownership ficam fora desta issue.
- `20260808140000` reconcilia antes do índice; `20260808150000` reaplica de forma idempotente (ambientes que já rodaram a V-45 antiga) e endurece o limite de nome.
