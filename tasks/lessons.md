# Lessons

- Resolva estados do Linear pelo identificador retornado pelo workspace; nomes genéricos como `In Progress` podem não existir no fluxo do time.
- Verifique o daemon do Docker antes de planejar validações da Supabase CLI. Quando ele não estiver disponível, um PostgreSQL temporário ainda pode provar sintaxe e invariantes, mas não substitui integralmente `supabase db reset`, pgTAP, `pgsql_check` ou geração automática de tipos.
- No TypeScript 6, helpers que consomem somente variáveis específicas não devem exigir `NodeJS.ProcessEnv`; um mapa de strings opcionais mantém testes com ambientes parciais corretamente tipados.
