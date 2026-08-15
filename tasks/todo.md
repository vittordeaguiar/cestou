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
- [x] Publicar o PR.

## Comentários do PR #14

- [x] Reproduzir a perda de foco ao fechar os diálogos de edição e criação sem trigger Radix.
- [x] Restaurar o foco ao acionador original, com fallback acessível quando ele sair do DOM.
- [x] Executar validações, revisar o diff e publicar os commits de correção.

## Review

- V-51: o diálogo de edição agora é único e fica acima das listas filtradas; sucesso fecha o diálogo e falha restaura o snapshot completo com feedback visível.
- V-52: criação usa FAB alinhado ao contêiner e sheet inferior com `90dvh`, rolagem interna, footer persistente e safe area; checkbox, filtros e ações mantêm alvos de pelo menos 44 px.
- Linhas foram memorizadas, callbacks de compra/edição estabilizados e partição/filtro usam memoização; não foi adicionada virtualização, swipe ou dependência.
- V-53: estado vazio ganhou onboarding e CTA para o mesmo sheet; criação otimista e primeiro INSERT Realtime removem o onboarding.
- Correção pós-review: o diálogo guarda somente o ID selecionado e deriva a linha de `items`, então uma falha restaura a versão Realtime mais recente em vez do objeto capturado ao abrir.
- Review do PR #14: edição e criação restauram foco ao acionador; quando uma mutação remove esse nó, o foco vai para o FAB ou para o título da seção.
- Nenhuma migration, enum, policy de RLS, convite ou implementação de estimativa foi adicionada.
- `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test` (104 testes), `npm run build` e `git diff --check` passaram.
- `npm run db:test` alcançou a tentativa de conexão fora do sandbox, mas o Postgres/Supabase local não estava ativo.
- Smoke em navegador alcançou o login local em Chrome e navegador interno; a lista exige sessão autenticada inexistente, então a inspeção visual mobile/desktop permanece manual. O fluxo mobile está coberto em jsdom a 390 × 844.
- PR draft #14 aberto contra `main` a partir de `codex/sprint-2-lista-core`.
- `handoff.md` permaneceu não rastreado e inalterado.

# Sprint 3 — Setup da estimativa de gasto

# Correção — variáveis públicas no cliente Next.js

## Plano

- [x] Corrigir o acesso às variáveis públicas do Supabase no bundle client, preservando o helper server-side e o fallback da chave anon.
- [x] Adicionar regressão para garantir que o cliente browser receba URL e chave públicas sem depender de lookup dinâmico em `process.env`.
- [x] Executar testes direcionados, format check, lint, typecheck, build e revisar o diff sem incluir `handoff.md`.

## Resultado

- O cliente browser deixou de usar lookup dinâmico de `process.env`; referências públicas estáticas são agora entregues ao helper validável sem alterar o cliente server-side.
- A regressão cobre a chave publishable e o fallback legado `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- `npm test` passou com 27 arquivos e 170 testes; `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run build` e `git diff --check` também passaram.
- O erro era causado pelo bundle client do Next.js 16/Turbopack, não pela ausência da variável no `.env.local` nem pelas migrations do Supabase.
- `handoff.md` permaneceu não rastreado e fora da alteração.

## Plano

- [x] Atualizar `main` por fast-forward e criar `codex/sprint-3-estimation-setup`, preservando `handoff.md`.
- [x] V-54: implementar cliente Firecrawl server-only, contratos mínimos e erros seguros.
- [x] V-54: cobrir transporte e falhas do Firecrawl com testes unitários mockados.
- [x] V-55: implementar cliente DeepSeek server-only para JSON estruturado.
- [x] V-55: cobrir transporte, parsing e falhas do DeepSeek com testes unitários mockados.
- [x] V-56: criar configuração tipada e builder seguro das fontes iniciais.
- [x] V-56: documentar fontes habilitadas, experimentais e descartadas.
- [x] Executar format, lint, typecheck, testes, build e revisão final do diff.
- [x] Criar um commit por issue e registrar o resultado desta entrega.

## Decisões

- Usar wrappers HTTP pequenos e tipados para as duas APIs, sem novas dependências.
- Ler credenciais de modo lazy e centralizado para manter build e testes sem chaves reais.
- Manter toda integração server-only e não expor Actions, rotas ou UI incompletas.
- Não alterar `price_estimates`, migrations ou RLS neste bloco.

## Review

- V-54: cliente Firecrawl server-only implementado sobre a API REST v2, com busca, scraping, timeout, respostas normalizadas e erros seguros; nenhum SDK ou dependência foi adicionado.
- V-55: cliente DeepSeek server-only implementado sobre `/chat/completions`, com modelos V4 permitidos, JSON mode, thinking desabilitado, decoder runtime e rejeição explícita de respostas vazias, inválidas ou truncadas.
- As configurações são lidas de forma lazy e centralizada. O build passou sem `FIRECRAWL_API_KEY` ou `DEEPSEEK_API_KEY` disponíveis no ambiente da tarefa.
- V-56: Angeloni, Super Muffato, Zona Sul e Drogaria Venancio ficaram habilitados; Drogasil e Araujo ficaram experimentais e desabilitados.
- Carrefour, Pão de Açúcar, Savegnago, Pague Menos/Extrafarma e Panvel foram documentados como descartados por termos ou regras de robots incompatíveis com o fluxo previsto.
- Foram adicionados 28 testes de integrações/fontes; a suíte completa passou com 24 arquivos e 132 testes.
- `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` e `git diff --check` passaram. O primeiro build falhou apenas porque o sandbox bloqueou o download das fontes Geist; a repetição com rede permitida passou.
- Não houve migration, alteração de `price_estimates`, RLS, Server Action, rota pública, UI, convite ou implementação antecipada de V-57 a V-63.
- A validação real dos provedores continua manual por falta de credenciais; os comandos pequenos estão em `docs/fontes-de-precos.md`.
- A base está pronta para iniciar V-57 a V-60, mantendo scraping específico, localização e prompt final fora deste bloco.
- `handoff.md` permaneceu não rastreado e inalterado.

# V-57 — Server Action de estimativa sob demanda

## Plano

- [x] Criar a branch da V-57 sobre o setup V-54–V-56 e manter `handoff.md` intacto.
- [x] Definir contratos serializáveis da Action e da orquestração, sem expor dados brutos dos provedores.
- [x] Implementar autenticação/autorização e reler os itens pendentes da lista no servidor.
- [x] Adicionar lock atômico por lista e persistência segura em `price_estimates` via funções do banco.
- [x] Orquestrar Firecrawl e DeepSeek com uma extração mínima, mantendo V-58, V-59 e V-60 extensíveis.
- [x] Cobrir sucesso, erro parcial, falha total, ausência de itens, acesso indevido e concorrência com testes.
- [x] Executar format, lint, typecheck, testes, build, testes de banco quando disponíveis e revisar o diff.
- [x] Registrar resultados, criar commit, publicar as branches necessárias e abrir o PR da V-57.

## Decisões

- A Action recebe somente `groupId`; identidade, lista e itens são derivados da sessão e do banco.
- `loading` será representado pelo estado pendente de React quando a UI da V-63 consumir a Action; o retorno cobre estados finais.
- O lock será persistente no Postgres, não em memória, para funcionar em múltiplas instâncias do servidor.
- Esta entrega não adiciona botão, card de estimativa, seletores frágeis nem fallback genérico.

## Review

- A Action recebe apenas um `groupId` validado, autentica a sessão, confirma o vínculo e relê os itens pendentes da lista via RLS; conteúdo e ownership nunca vêm do client.
- A orquestração consulta em paralelo somente os domínios habilitados para a categoria, limita a evidência enviada ao DeepSeek e aceita apenas preço positivo associado a uma URL realmente retornada e aprovada.
- Resultados completos e parciais são persistidos; falha total preserva a estimativa anterior e retorna mensagem segura. O estado `loading` continuará sendo o pending do React quando a V-63 adicionar a UI.
- A migration `20260814214500_add_price_estimate_lock.sql` adiciona lock distribuído de três minutos e RPCs atômicos de adquirir, finalizar e liberar. Somente `service_role` pode executá-los; `authenticated` continua sem escrita direta.
- Foram adicionados 16 testes unitários e 13 asserções pgTAP para autenticação, concorrência, sucesso, parcial, falhas, domínios e privilégios.
- `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test` (26 arquivos, 148 testes), `npm run build` e `git diff --check` passaram.
- Todas as migrations foram aplicadas em PostgreSQL 17 temporário; o smoke confirmou lock inicial `true`, concorrente `false`, persistência `42.50` e remoção do lock.
- `npm run db:test` não conectou porque o Supabase/Docker local não está ativo; a suíte pgTAP nova permanece para execução no ambiente completo.
- O primeiro build da rodada final falhou porque o sandbox não alcançou o Google Fonts; a repetição com rede permitida passou.
- Nenhuma UI, scraping por seletores, fallback genérico, retentativa ou convite foi adicionado. `handoff.md` permanece não rastreado e inalterado.

# V-58 — Scraping específico das fontes de preço

## Plano

- [x] Criar o coletor server-only para URLs específicas e chamadas Firecrawl `scrape`.
- [x] Implementar seleção por categoria, prioridade, concorrência limitada, validação de domínio e normalização de Markdown.
- [x] Diferenciar `found`, `not_found` e `failed` por fonte sem expor erros internos.
- [x] Refatorar o estimador para consumir somente evidências normalizadas, preservando a Action e a persistência da V-57.
- [x] Cobrir coletor, Firecrawl e estimador com testes unitários sem chamadas reais.
- [x] Executar validação completa, documentar eventual smoke manual e revisar o diff.
- [x] Atualizar Linear, criar commit, fazer push e abrir PR pronto para revisão contra `main`.

## Decisões

- A V-58 usa somente o endpoint `scrape`; a busca genérica permanece na V-59.
- Fontes habilitadas são ordenadas por prioridade e processadas com no máximo duas chamadas concorrentes por item.
- Conteúdo vazio após normalização é `not_found`; falha parcial não interrompe as demais fontes e somente falha total produz `failed` para o item.
- A localização permanece `unresolved` porque a lista ainda não fornece CEP, loja ou região.
- Não serão adicionados retries, migrations, dependências, UI, interações de navegador, cookies artificiais ou seletores frágeis.

## Review

- O coletor usa somente `scrape`, mantém a ordem de prioridade, limita duas fontes concorrentes por item, valida o domínio retornado e normaliza o Markdown antes do DeepSeek.
- O estimador preserva `PriceEstimateResult`, quantidade, persistência, lock e Server Action da V-57; somente o seam interno de coleta foi substituído.
- A suíte passou com 27 arquivos e 158 testes; `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run build` e `git diff --check` passaram.
- `npm run db:test` não conectou ao PostgreSQL local (`LegacyDbConnectError`); nenhuma migration foi criada. `FIRECRAWL_API_KEY` não estava disponível, então a validação real do provedor permanece manual e documentada.
- Linear foi atualizado: V-58 está em Code Review; V-57, V-59, V-60 e V-62 receberam descrições alinhadas às fronteiras da entrega.
- Commit `c615cf8` foi publicado na branch `codex/v-58-firecrawl-source-scraping`; o PR #18 está pronto para revisão contra `main` e V-58 está em Code Review no Linear.
- O setup V-54–V-56 foi publicado no draft PR #15; a V-57 foi publicada isoladamente no draft PR empilhado #16.

## Correção pós-review V-58 — estabilização da concorrência

- [x] Implementar limitador FIFO global de duas chamadas `scrape` por instância do coletor.
- [x] Cobrir coletas simultâneas, liberação do permit, categoria `outro`, URLs retornadas e falhas parciais.
- [x] Comprovar FIFO real entre duas coletas simultâneas com raspagens controladas.
- [x] Comprovar liberação do permit após resultado `not_found`.
- [x] Atualizar documentação, lições e descrição da V-58 no Linear.
- [x] Executar validações, revisar o diff e confirmar que `handoff.md` permanece fora do PR.
- [x] Criar commit adicional, fazer push e atualizar o PR #18 pronto para revisão.

### Resultado

- O coletor agora compartilha uma fila FIFO global por instância, com no máximo duas raspagens simultâneas e liberação garantida em todos os caminhos de resultado.
- A cobertura passou de 158 para 168 testes; foram adicionadas regressões para FIFO real entre coletas concorrentes, categoria `outro`, URLs retornadas, validação de URL, liberação do permit após sucesso, `not_found` e falhas, além do sucesso parcial.
- `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` e `git diff --check` passaram.
- `npm run db:test` não conectou ao PostgreSQL local (`LegacyDbConnectError`); nenhuma migration foi criada.
- O PR #18 e a descrição da V-58 no Linear foram atualizados; `handoff.md` permanece não rastreado e fora do commit.

# V-59 — Busca genérica do Firecrawl

## Plano

- [x] Atualizar `main` e criar `task/v-59-firecrawl-generic-search`, preservando `handoff.md`.
- [x] Estender o coletor server-only com Search como fallback após ausência de evidência específica.
- [x] Filtrar resultados genéricos por relevância, preço em R$, URL segura e duplicidade.
- [x] Compartilhar o limitador FIFO do Firecrawl entre scraping e Search.
- [x] Integrar evidências genéricas ao estimador sem alterar a Server Action ou o prompt definitivo.
- [x] Cobrir transporte, filtragem, fallback, falhas, concorrência e não uso prematuro do Search.
- [x] Atualizar a documentação da estratégia de fontes e registrar o resultado.
- [x] Executar format, lint, typecheck, testes, build e revisão final do diff.
- [x] Criar commit local e atualizar a V-59 para `Testing` após as validações.

## Decisões

- O Search usa a query `${item} preço`, limite 5, conteúdo Markdown e configuração BR do cliente Firecrawl.
- A busca genérica só roda quando a coleta específica não tiver nenhum resultado `found`.
- Um resultado precisa ter URL HTTP(S) segura, termo relevante do item e preço brasileiro claro com `R$`.
- Resultados genéricos usam contrato próprio com `sourceId` `firecrawl-search`; evidências seguem o formato atual do DeepSeek.
- Não haverá migration, dependência nova, UI, alteração da Action, retry ou mudança do prompt da V-60.

## Review

- O coletor adiciona `search(item)` com a query `${item} preço`, conteúdo Markdown, limite 5 e configuração BR; a busca compartilha a fila FIFO global de duas chamadas com o Scrape.
- Resultados são normalizados e filtrados por tokens do item, preço brasileiro com `R$`, URL HTTP(S) sem credenciais e URL única. Conteúdo irrelevante ou sem preço vira `not_found`; falhas tipadas não vazam detalhes internos.
- O estimador chama Search somente quando a coleta específica não possui `found`, envia as evidências genéricas ao mesmo contrato do DeepSeek e não faz fallback adicional após uma evidência específica sem preço.
- Foram adicionados testes de payload Firecrawl, normalização, filtragem, duplicidade, URLs inseguras, falhas, fallback, concorrência global e não uso prematuro; a suíte passou com 27 arquivos e 177 testes.
- `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` e `git diff --check` passaram.
- Nenhuma migration, alteração de RLS, Server Action, UI, dependência ou chamada real ao Firecrawl foi adicionada. `handoff.md` permanece não rastreado e fora do commit.

# V-60 — Prompt definitivo do DeepSeek

## Plano

- [x] Finalizar o contrato JSON com `item`, `found`, `unitPrice` e `sourceUrl`, preservando a integração existente.
- [x] Substituir o prompt preliminar por regras fixas de extração segura, promoções explícitas, ambiguidades e indisponibilidade.
- [x] Validar item solicitado, preço positivo e URL pertencente às evidências fornecidas.
- [x] Implementar uma única recuperação para `invalid_response_error`, sem retry de falhas de transporte.
- [x] Cobrir contrato, prompt, respostas ambíguas, múltiplos preços, promoções, indisponibilidade e fallback.
- [x] Executar validações completas, revisar o diff e registrar o resultado sem incluir `handoff.md`.
- [x] Atualizar V-60 para `Testing` e criar commit local após as validações.

## Decisões

- O contrato mantém os nomes internos existentes e adiciona `item`; `sourceUrl` representa a fonte do preço.
- O item retornado precisa corresponder ao item solicitado após normalização simples de caixa e espaços.
- Promoção só é aceita quando estiver claramente vigente e associada ao item; preços conflitantes, variantes ambíguas e indisponibilidade retornam `found: false`.
- A recuperação faz exatamente uma nova chamada apenas para `invalid_response_error`, reutilizando as mesmas evidências e uma instrução mais estrita.
- Não haverá migration, dependência, alteração da Server Action, lock, persistência, UI, RLS ou contrato das fontes.

## Review

- O estimador agora envia um prompt fixo com regras explícitas para não inventar valores, aceitar somente preço atual inequívoco, tratar promoções aplicáveis e rejeitar conflitos, variantes ambíguas e indisponibilidade.
- O decoder exige exatamente `item`, `found`, `unitPrice` e `sourceUrl`; normaliza caixa/espaços do item, aceita somente preço positivo e limita a fonte às URLs das evidências.
- Respostas inválidas geram uma única nova chamada com a mesma evidência e instrução de correção. Erros de autenticação, transporte, limite e timeout não são repetidos; a falha externa permanece segura.
- Foram adicionadas regressões para prompt, contrato, item incorreto, preço/fonte inválidos, campos extras, `found=false`, política de preço, fallback único, ausência de terceira chamada e falhas de transporte.
- `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test` (27 arquivos, 186 testes), `npm run build` e `git diff --check` passaram.
- A documentação em `docs/fontes-de-precos.md` registra o contrato e o comportamento definitivo. Não houve migration, RLS, Server Action, lock, persistência, UI ou dependência nova; `handoff.md` permanece não rastreado e fora do commit.
