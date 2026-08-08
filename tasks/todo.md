# V-47 — Tela de gerenciamento de membros do grupo

## Plano

- [x] Atualizar a partir de `main` e criar branch `cursor/v-47-group-members-management-c025`.
- [x] Helpers de listagem + actions remove/leave alinhadas ao RLS.
- [x] Página `/members`, painel com Dialog, link na lista, README.
- [ ] Testes, checks sequenciais, commit/push e PR.

## Notas

- Sem migration nova: policies de `group_members` / `group_invites` já cobrem o escopo.
- Criar/cancelar convites e transferir ownership ficam fora desta issue.
