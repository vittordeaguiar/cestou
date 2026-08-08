# Cestou

App web mobile-first para lista de compras compartilhada com estimativa de gasto via IA.

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- Supabase (Postgres + Auth + RLS)
- DeepSeek + Firecrawl (estimativa de preços)
- Deploy na Vercel

## Setup

```bash
npm install
cp .env.example .env.local
# Fill NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.
# Keep NEXT_PUBLIC_SITE_URL=http://localhost:3000 for local development.
npm run dev
```

## Autenticação (V-43 / V-44)

- A v1 usa apenas e-mail e senha via Supabase Auth. As sessões SSR ficam em cookies e são renovadas pelo `proxy.ts` do projeto.
- O proxy também aplica a matriz de rotas: `/profile` e `/app/**` exigem sessão; `/auth/login` e `/auth/sign-up` redirecionam usuários autenticados para `/app` (ou para um `next` interno seguro); `/` permanece pública; `/design-system` só em desenvolvimento.
- Ao tentar acessar uma rota protegida sem sessão, o login recebe `?next=` com o destino original (apenas caminhos internos iniciados com `/`).
- No Vercel, configure `NEXT_PUBLIC_SITE_URL=https://cestou-kohl.vercel.app`; configure a mesma URL em Supabase Auth > URL Configuration e mantenha a confirmação de e-mail desativada enquanto o produto estiver em beta privado.
- Não configure nem exponha `SUPABASE_SERVICE_ROLE_KEY` no browser. Os fluxos de autenticação e perfil não usam essa chave.
- Confirmação de e-mail, recuperação de senha, OAuth, magic link, OTP, alteração de e-mail/senha, avatar e exclusão de conta não fazem parte desta versão.

## Grupos (V-45 / V-47)

- Usuário autenticado cria um grupo em `/app/groups/new` (nome obrigatório).
- A RPC `create_group` torna o criador `owner` e o trigger do banco cria a lista ativa compartilhada.
- Após criar, o app redireciona para `/app/groups/[groupId]/list`.
- Regra v1: cada usuário participa de no máximo um grupo (índice único + checagem na RPC). `/app` envia quem já tem grupo para a lista e quem não tem para a criação.
- Em `/app/groups/[groupId]/members`: listar membros; owner remove membros comuns; membro comum pode sair; owner vê convites pendentes (somente leitura nesta etapa).
- Antes do índice único, as migrations reconciliam memberships duplicadas (preferem `owner`, senão a mais antiga; promovem owner se um grupo ficaria órfão; removem grupos vazios).
- Nome do grupo: máximo 80 caracteres na UI, na RPC `create_group` e na constraint `groups_name_max_length`.

## Lista (V-48)

- Em `/app/groups/[groupId]/list`, membros adicionam/editan/removem itens em `list_items` (nome, quantidade > 0, unidade opcional).
- Persistência via sessão do usuário e RLS; `created_by` é preenchido na criação e permanece imutável.
- Unidade opcional: coluna `unit` (texto livre, máx. 20).

## Scripts

| Comando          | Descrição                   |
| ---------------- | --------------------------- |
| `npm run dev`    | Servidor de desenvolvimento |
| `npm run build`  | Build de produção           |
| `npm run lint`   | ESLint                      |
| `npm run format` | Prettier                    |
| `npm test`       | Vitest (CI)                 |

## Estrutura

```
app/                 # Rotas e layouts (App Router)
components/          # Componentes React
lib/supabase/        # Browser, server, admin clients + session middleware
types/               # Tipos TypeScript compartilhados
.cursor/rules/       # Regras do agente / padrões do projeto
```
