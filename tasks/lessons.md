# Lessons

- Resolva estados do Linear pelo identificador retornado pelo workspace; nomes genéricos como `In Progress` podem não existir no fluxo do time.
- Verifique o daemon do Docker antes de planejar validações da Supabase CLI. Quando ele não estiver disponível, um PostgreSQL temporário ainda pode provar sintaxe e invariantes, mas não substitui integralmente `supabase db reset`, pgTAP, `pgsql_check` ou geração automática de tipos.
- No TypeScript 6, helpers que consomem somente variáveis específicas não devem exigir `NodeJS.ProcessEnv`; um mapa de strings opcionais mantém testes com ambientes parciais corretamente tipados.
- Em policies que consultam a própria tabela, use helpers `SECURITY DEFINER` de escopo mínimo para evitar recursão de RLS; cada helper precisa de `search_path` explícito e privilégios de execução revisados.
- Não torne uma variável nova obrigatória no helper compartilhado de clientes se o proxy existente a chama em toda requisição. Valide configurações específicas no helper próprio, para manter rotas públicas e renovação de sessão compatíveis com ambientes já configurados.
- Componentes responsáveis por confirmar ou reverter uma mutação otimista não podem viver dentro da projeção filtrada que a própria mutação altera; mantenha diálogo, snapshot e feedback em um ancestral estável até a resposta final.
- Ao elevar um diálogo acima de uma coleção sincronizada, mantenha no estado apenas a identidade do alvo e derive a linha atual da fonte canônica; guardar o objeto inteiro congela dados anteriores a eventos Realtime e torna o rollback obsoleto.
- Modais controlados sem `Trigger` precisam restaurar foco explicitamente em `onCloseAutoFocus`; preserve o acionador e ofereça um fallback conectado ao DOM quando a mutação puder removê-lo.
- Em testes de timeout com timers falsos, registre a asserção de rejeição antes de avançar o relógio; anexar o handler depois do abort produz uma rejeição não tratada mesmo quando o teste parece passar.
- Uma RPC `SECURITY DEFINER` usada por uma Server Action não deve herdar execução de `authenticated` quando grava dados que o RLS torna somente leitura; restrinja-a ao `service_role`, revalide o usuário recebido no banco e mantenha a chave apenas no módulo server-only.
- Ao normalizar Markdown, remova linhas vazias antes de deduplicar linhas consecutivas; o teste deve refletir a ordem real do pipeline para não preservar duplicatas separadas apenas por espaços vazios.
- Um limite aplicado dentro de cada item não protege o provedor quando o orquestrador inicia vários itens em paralelo; a fila deve ser compartilhada no limite da integração e testada com coletas simultâneas.
