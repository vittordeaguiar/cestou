# V-40 — Configuração de RLS (políticas por grupo)

## Plano

- [x] Ler V-40 e a migration/schema entregues pela V-39.
- [x] Criar a branch dedicada a partir da `main` atualizada.
- [x] Definir papéis `owner` e `member`, operações privilegiadas e limites de acesso direto.
- [x] Adicionar a migration de RLS, políticas e RPCs seguras.
- [x] Criar testes de autorização para A, B, C e usuário sem grupo.
- [x] Executar validações SQL, formatação, lint, testes, typecheck e build.
- [x] Revisar o diff, registrar evidências e aprendizados.
- [ ] Commitar, publicar a branch e abrir PR para `main`.
- [ ] Mover V-40 para Code Review e comentar o resultado no Linear.

## Review

- Migration aplicada em PostgreSQL 17 temporário com contrato mínimo de `auth.users`, `auth.uid()` e `auth.jwt()`.
- Smoke tests confirmaram isolamento de leitura/escrita entre grupos, edição colaborativa, bloqueio de insert cruzado e RPCs de convite/transferência.
- A suíte pgTAP cobre A, B, C, D e E, mas não pôde ser executada porque a extensão `pgtap` não está instalada; Supabase CLI e Docker também não estão disponíveis localmente.
- Prettier passou para os arquivos formatáveis da issue; o comando global falha apenas pelo `handoff.md` não rastreado e preexistente. Arquivos SQL não têm parser configurado no Prettier.
- ESLint e Vitest passaram (5 testes). O typecheck passou ao silenciar a depreciação preexistente de `baseUrl` com `--ignoreDeprecations 6.0`; o build passou ao executá-lo com acesso de rede para as fontes Geist.
- Nenhuma migration foi aplicada ao banco remoto.
