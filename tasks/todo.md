# V-39 — Modelagem do banco de dados

## Plano

- [x] Ler a issue V-39 no Linear e confirmar escopo e restrições.
- [x] Criar uma branch local dedicada à issue.
- [x] Inspecionar arquitetura, migrations, tipos e scripts existentes.
- [x] Verificar se o schema já foi total ou parcialmente implementado.
- [x] Validar com o usuário o diagnóstico, modelo, cascatas, riscos e SQL proposto.
- [x] Adicionar a infraestrutura local versionada do Supabase e a migration inicial.
- [x] Adicionar testes de integração SQL para constraints e invariantes do schema.
- [x] Aplicar a migration do zero em PostgreSQL 17 e atualizar os tipos TypeScript do schema.
- [x] Executar format check, lint, typecheck, testes e build.
- [x] Revisar o diff final, documentar evidências e registrar aprendizados relevantes.
- [x] Commitar, publicar a branch e abrir um PR para `main`.
- [x] Mover V-39 para Code Review e comentar o resultado e o escopo deixado para V-40.

## Review

- Migration aplicada do zero em um cluster PostgreSQL 17 temporário com contrato mínimo de `auth.users`.
- Smoke tests SQL passaram para lista ativa, quantidade, categoria, membros, convites, estimativas e cascata.
- Banco resultante: 7 tabelas públicas, 10 foreign keys, 19 índices e RLS desabilitada nas 7 tabelas.
- Prettier dos arquivos da issue, ESLint, typecheck, Vitest (5 testes) e build Next.js passaram.
- `supabase db reset`, pgTAP e geração automática dos tipos ficaram bloqueados porque o Docker daemon não estava ativo e a abertura do Docker Desktop não foi autorizada.
- `supabase db lint` conectou ao PostgreSQL temporário, mas a extensão `pgsql_check` não está disponível na instalação Homebrew.
- Nenhuma migration ou estrutura foi aplicada ao banco remoto.
- PR aberto: <https://github.com/vittordeaguiar/cestou/pull/2>.
- V-39 movida para Code Review, com evidências e riscos da V-40 registrados em comentário.
