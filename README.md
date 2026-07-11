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
# Fill NEXT_PUBLIC_SUPABASE_* and SUPABASE_SERVICE_ROLE_KEY
npm run dev
```

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
