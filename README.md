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
npm run dev
```

## Scripts

| Comando          | Descrição                   |
| ---------------- | --------------------------- |
| `npm run dev`    | Servidor de desenvolvimento |
| `npm run build`  | Build de produção           |
| `npm run lint`   | ESLint                      |
| `npm run format` | Prettier                    |

## Estrutura

```
app/          # Rotas e layouts (App Router)
components/   # Componentes React
lib/          # Utilitários e clients
types/        # Tipos TypeScript compartilhados
```
