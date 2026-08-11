# Sprint 2 — Lista de Compras (core)

## Plano

- [x] Atualizar `main` por fast-forward e criar `codex/sprint-2-lista-core` preservando arquivos locais.
- [x] V-51: manter edição e rollback montados quando a categoria muda sob filtro ativo.
- [x] V-52: mover criação para FAB + sheet mobile-first e revisar touch targets, safe areas e teclado.
- [x] V-52: reduzir renders desnecessários sem virtualização ou dependências novas.
- [x] V-53: adicionar onboarding e ação principal ao estado vazio, inclusive para criação via Realtime.
- [x] Cobrir categorias, filtros, rollback, Realtime, estado vazio e viewport mobile em testes.
- [x] Executar format, lint, typecheck, testes, build, testes de banco quando disponíveis e smoke visual.
- [x] Revisar o diff, registrar resultados e criar o commit local.

## Decisões

- Enum/coluna já existiam no schema (`mercado` | `farmacia` | `outro`, nullable).
- Nenhuma migration ou alteração de RLS será criada.
- V-46, estimativa de preços, swipe e virtualização permanecem fora do escopo.

## Correção pós-review

- [x] Reproduzir UPDATE Realtime durante edição seguido de falha da action.
- [x] Manter no diálogo a linha canônica mais recente sem desmontá-lo sob filtro ativo.
- [x] Garantir que o rollback preserve os dados remotos e adicionar a regressão aos testes.
- [x] Executar a validação completa, revisar o diff e registrar o resultado.
- [ ] Publicar o PR.

## Review

- V-51: o diálogo de edição agora é único e fica acima das listas filtradas; sucesso fecha o diálogo e falha restaura o snapshot completo com feedback visível.
- V-52: criação usa FAB alinhado ao contêiner e sheet inferior com `90dvh`, rolagem interna, footer persistente e safe area; checkbox, filtros e ações mantêm alvos de pelo menos 44 px.
- Linhas foram memorizadas, callbacks de compra/edição estabilizados e partição/filtro usam memoização; não foi adicionada virtualização, swipe ou dependência.
- V-53: estado vazio ganhou onboarding e CTA para o mesmo sheet; criação otimista e primeiro INSERT Realtime removem o onboarding.
- Correção pós-review: o diálogo guarda somente o ID selecionado e deriva a linha de `items`, então uma falha restaura a versão Realtime mais recente em vez do objeto capturado ao abrir.
- Nenhuma migration, enum, policy de RLS, convite ou implementação de estimativa foi adicionada.
- `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test` (102 testes), `npm run build` e `git diff --check` passaram.
- `npm run db:test` alcançou a tentativa de conexão fora do sandbox, mas o Postgres/Supabase local não estava ativo.
- Smoke em navegador alcançou o login local em Chrome e navegador interno; a lista exige sessão autenticada inexistente, então a inspeção visual mobile/desktop permanece manual. O fluxo mobile está coberto em jsdom a 390 × 844.
- `handoff.md` permaneceu não rastreado e inalterado.
