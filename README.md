# Expense Tracker

Personal, mobile-first expense tracker. Next.js 16 (React + TypeScript) · Supabase Postgres (Mumbai) · Drizzle ORM · Tailwind + shadcn/ui · deployed on Vercel (`bom1`).

## Setup

1. Node 22 via nvm: `nvm use 22`
2. `npm install`
3. Create a Supabase project in **Mumbai (ap-south-1)**, then `cp .env.example .env.local` and fill it in.
4. Apply the schema: `npm run db:migrate`
5. `npm run dev` → http://localhost:3000

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm test` | Unit tests (Vitest) |
| `npm run typecheck` / `npm run lint` | Static checks |
| `npm run db:generate` | Create a migration from `src/server/db/schema.ts` |
| `npm run db:migrate` | Apply migrations (uses `DIRECT_URL`) |
| `npm run db:studio` | Browse the DB |

## Conventions

- **Money is integer paise** (`src/lib/money.ts`). Never floats.
- **Dates are IST calendar days** stored as `YYYY-MM-DD` (`src/lib/dates.ts`).
- **Balances are derived** from the `transactions` ledger; adjustments record reconciliation differences.
- **Business logic lives in `src/server/services/*`**, shared by server actions (web) and `/api/v1/*` (future mobile app).
- Every table has `user_id` + Supabase RLS.

## Latency check

`GET /api/bench` runs three `select 1` queries and reports timings, region and whether the function was cold.
