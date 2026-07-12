# V-43 — Login/cadastro via Supabase Auth

## Plano

- [x] Ler V-43 no Linear, auditar clientes Supabase, schema/policies, design system e versões instaladas.
- [x] Confirmar perfil por trigger de banco e `/profile` como destino padrão após autenticação.
- [x] Criar a migration de sincronização `auth.users` → `profiles` e os testes SQL correspondentes.
- [x] Implementar validação compartilhada, destinos internos seguros e ações SSR de autenticação/perfil.
- [x] Criar as rotas de cadastro, login e perfil com os componentes do design system.
- [x] Cobrir validação, ações, loading, prevenção de submit duplicado e fluxos de perfil em testes.
- [x] Documentar configuração, limitações da v1, resultados das verificações e roteiro manual.
- [x] Executar lint, typecheck, testes, formatação, build e inspeção em browser quando disponível.

## Review

- Estado inicial: lint, typecheck, Vitest (9 testes) e `format:check` passaram antes das alterações.
- O mecanismo de renovação de sessão existente usa `@supabase/ssr` e `getClaims()` no proxy; ele será preservado.
- A tabela `profiles` tem RLS para inserção e atualização do próprio usuário, mas ainda não possui trigger de criação após `auth.users`.
- `handoff.md` é não rastreado e preexistente; não pertence à V-43 e será preservado.
- A migration cria `profiles` de modo atômico por trigger `SECURITY DEFINER` de escopo mínimo; o aplicativo continua sujeito às policies existentes e não usa `service_role`.
- Lint, typecheck, Vitest (34 testes), `format:check` e build passaram. O build precisou de rede para buscar as fontes Geist.
- Smoke test local passou em 390 × 844 e 1440 × 900: labels, erros com `role=alert`, inputs e botão de 44 px, e layout responsivo foram verificados. Nenhum cadastro real foi criado.
- `npm run db:test` foi executado, mas não pôde conectar ao banco Supabase local porque o Docker/Postgres não está disponível; os testes pgTAP novos permanecem prontos para execução em ambiente com banco local.
- Não houve migration aplicada no banco remoto, alteração de estado no Linear, nem exposição de valor de variável de ambiente.
