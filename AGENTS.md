# Cestou — instruções para agentes

Estas regras orientam agentes que trabalham neste repositório. O pedido atual do usuário define o escopo; preserve segurança, dados e alterações de outros trabalhos.

## Antes de editar

1. Leia `README.md`, `tasks/lessons.md` e o bloco ativo de `tasks/todo.md`.
2. Execute `git status --short --branch` e inspecione o diff antes de assumir qualquer alteração.
3. Localize a implementação, testes, contratos e migrations relacionados. Não presuma a estrutura do projeto.
4. Para qualquer código Next.js, leia primeiro a guia correspondente em `node_modules/next/dist/docs/`. Esta versão usa Next.js 16 e pode divergir de exemplos conhecidos.
5. Para mudanças não triviais, registre um plano verificável em `tasks/todo.md` antes de implementar. Atualize o checklist durante o trabalho e registre resultado e lições após correções.

## Escopo e segurança

- Diferencie resposta, diagnóstico, revisão e implementação. Diagnóstico/revisão não autorizam mudanças; implemente quando o pedido solicitar correção ou construção.
- Preserve alterações não relacionadas. Arquivos não rastreados pertencem ao usuário até que seu escopo seja confirmado.
- `handoff.md` é local, não rastreado e nunca deve entrar em stage, commit ou PR.
- Use `apply_patch` para editar arquivos rastreados. Não use comandos shell para sobrescrever arquivos.
- Não use comandos destrutivos como `git reset --hard`, `git checkout --`, `rm -rf` ou resets remotos sem confirmar o alvo e a autorização.
- Não exponha, registre ou comite segredos. `.env*`, chaves de API, tokens, cookies e payloads privados ficam fora do diff e dos logs.
- Não adicione dependências, migrations ou mudanças de contrato por conveniência; justifique cada uma no plano.

## Arquitetura do projeto

- `app/` contém App Router, páginas, Server Components e Server Actions; `components/` contém a UI reutilizável.
- `lib/supabase/server.ts` é o cliente SSR por requisição; `lib/supabase/client.ts` é o cliente browser; `lib/supabase/admin.ts` é privilegiado e server-only; `proxy.ts` renova sessão e aplica a matriz de rotas.
- Integrações Firecrawl e DeepSeek são server-only, usam erros tipados e não devem fazer chamadas reais em testes unitários.
- A identidade, autorização e dados sensíveis devem ser relidos no servidor. Não confie em `groupId`, item, usuário ou preço fornecidos pelo cliente sem validação e verificação de ownership.
- Client Components não podem importar credenciais privadas. Variáveis `NEXT_PUBLIC_*` são públicas; no caminho client, acesse-as por referências estáticas `process.env.NEXT_PUBLIC_*`. Não passe o objeto `process.env` para helpers nem use lookup dinâmico.
- A UI de lista usa atualização otimista e Realtime: mantenha diálogos/snapshots fora de projeções que podem desaparecer, derive a linha atual da fonte canônica e restaure foco quando um diálogo controlado fechar.

## Supabase e banco

- `supabase/migrations/` é a fonte de verdade do schema, RLS, grants, triggers e RPCs. Não corrija o banco remoto diretamente pelo SQL Editor quando a alteração deve ser versionada.
- Antes de mudar schema, revise dependências e políticas. Em funções `SECURITY DEFINER`, use `search_path` explícito, escopo mínimo, validação do usuário e grants revisados.
- Teste migrations localmente com `supabase db reset`; rode `npm run db:test` somente se o PostgreSQL/Supabase local estiver disponível. `db:test` ausente por ambiente deve ser reportado, não mascarado.
- Aplicar mudanças em um projeto remoto exige autorização explícita: use `supabase db push` após conferir o projeto e um dry-run quando disponível. Nunca use `supabase db reset --linked` sem confirmação, pois ele apaga os dados remotos.
- Depois de mudanças de schema, atualize `types/database.ts` pelo fluxo do projeto e valide as chamadas tipadas.

## Desenvolvimento e validação

Use os scripts do `package.json`, sem inventar comandos alternativos:

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
git diff --check
```

- Comece por testes direcionados ao comportamento alterado; depois execute a suíte completa e os checks acima na ordem adequada ao risco.
- Para integrações, use mocks determinísticos e valide timeout, resposta inválida, erro tipado, conteúdo vazio, falha parcial e não vazamento de dados internos.
- Faça smoke manual de Firecrawl/DeepSeek somente quando as credenciais existirem. Registre apenas status, URL, resultado observável e dependência de localização.
- Em concorrência, limite chamadas no nível do provedor/orquestrador, não apenas dentro de cada item; teste coletas simultâneas e liberação em `finally`.
- Um build sem credenciais reais pode ser válido se a configuração for lazy; diferencie falha de código de limitação do ambiente.

## Git, PR e Linear

- Use branches `codex/<descricao-curta>` e commits pequenos, com escopo explícito. Stage caminhos específicos; nunca use `git add -A` com alterações não revisadas.
- Por padrão, implemente, valide e entregue o resultado localmente. Quando o pedido disser para concluir/publicar uma tarefa, o agente pode fazer commit, push, abrir PR e atualizar o Linear dentro do escopo confirmado.
- Abra PR contra `main`; deixe-o pronto para revisão somente com checks verdes. Use draft quando solicitado ou enquanto validações necessárias estiverem pendentes.
- No Linear, leia os estados disponíveis e use os identificadores retornados pelo workspace; não presuma nomes como `In Progress`. Atualize descrição, status e link do PR somente quando fizerem parte da entrega solicitada.
- Antes de entregar, confirme o diff final, branch, commit, checks, PR e arquivos excluídos. Nunca inclua `handoff.md`.

## Fontes de verdade

- `README.md`: setup, rotas e configuração operacional estável.
- `tasks/todo.md`: plano e resultado da tarefa corrente; seções antigas são histórico.
- `tasks/lessons.md`: correções de processo que devem evitar regressões.
- `docs/`: limitações e validação manual de provedores.
- `supabase/migrations/` e `types/database.ts`: contratos persistidos e tipos derivados.
