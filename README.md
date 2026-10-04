# Expense Tracker

Personal, mobile-first expense tracker. Next.js 16 (React + TypeScript) · Supabase Postgres (Mumbai) · Drizzle ORM · Tailwind + shadcn/ui · deployed on Vercel (`bom1`).

**Phase 1 features:** email-code sign-in (single allowlisted user) · quick add with offline queue · accounts, payment methods, categories · balances, add money, transfers, set actual balance · transactions list with search/filters, swipe to edit/delete with undo · spending dashboard · dark mode · installable PWA (opens offline) · CSV export · REST API (`/api/v1`) · weekly encrypted backups.

## Setup

1. Node 22 via nvm: `nvm use 22`
2. `npm install`
3. Create a Supabase project in **Mumbai (ap-south-1)**, then `cp .env.example .env.local` and fill it in.
4. Apply the schema: `npm run db:migrate`
5. `npm run dev` → http://localhost:3000

Sign-in uses Supabase email OTP. With a custom SMTP sender (e.g. Gmail + app password) set in Supabase → Authentication → Emails, add `{{ .Token }}` to the "Magic link or OTP" template so the email contains the code.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm test` | Unit tests (Vitest) |
| `npm run typecheck` / `npm run lint` | Static checks |
| `npm run build` / `npm start` | Production build / server (the service worker only registers in production) |
| `npm run db:generate` | Create a migration from `src/server/db/schema.ts` |
| `npm run db:migrate` | Apply migrations (uses `DIRECT_URL`) |
| `npm run db:studio` | Browse the DB |
| `node scripts/generate-icons.mjs` | Regenerate PWA icons in `public/icons` |

## Conventions

- **Money is integer paise** (`src/lib/money.ts`). Never floats.
- **Dates are IST calendar days** stored as `YYYY-MM-DD` (`src/lib/dates.ts`).
- **Balances are derived** from the `transactions` ledger: opening balance + transactions dated on/after the account's opening date (`src/lib/balance.ts`). Adjustments record reconciliation differences.
- **Business logic lives in `src/server/services/*`**, shared by server actions (web) and `/api/v1/*` (mobile/scripts).
- Every table has `user_id` + Supabase RLS.
- Quick-add entries get a client UUID and go to a localStorage queue before sending; creates are idempotent on that id.

## API (`/api/v1`)

Authenticate with the web session cookie, or `Authorization: Bearer <Supabase access token>` for a mobile app. Only the allowlisted email is accepted. Amounts are integer **paise**; dates are `YYYY-MM-DD` (IST).

| Method & path | Purpose |
|---|---|
| `GET /me` | Signed-in user |
| `GET /options` | Categories, payment methods, accounts for entry forms |
| `GET /accounts` | Accounts with balances |
| `GET /transactions` | List; query `q, category, method, account, type, from, to, limit` |
| `POST /transactions` | Create `{ type: "expense"\|"income"\|"transfer", id: <uuid>, ... }` (idempotent on `id`) |
| `PATCH /transactions/:id` | Update `{ type, ...fields }` |
| `DELETE /transactions/:id` | Soft delete |
| `POST /transactions/:id/restore` | Undo a delete |
| `GET /dashboard` | Dashboard numbers; `period=week\|month&anchor=YYYY-MM-DD` |
| `GET /export` | CSV (same filters as `/transactions`) |

Errors are JSON: `400 { error, issues? }` for bad input, `401` when not signed in.

## Backups

`.github/workflows/backup.yml` runs every Sunday 02:00 IST (and on demand from the Actions tab). It dumps the `public` schema with `pg_dump`, **encrypts it with AES-256** (this repo is public, and workflow artifacts on public repos are downloadable by any signed-in GitHub user), and keeps it as a workflow artifact for 90 days. The weekly query also stops the free Supabase project from pausing.

**One-time setup** — GitHub repo → Settings → Secrets and variables → Actions → New repository secret:

- `BACKUP_DATABASE_URL` — Supabase **session pooler** URL: your `DATABASE_URL` with port `5432` instead of `6543` (user `postgres.<project-ref>`). The direct `db.<ref>.supabase.co` host is IPv6-only and unreachable from GitHub's runners.
- `BACKUP_PASSPHRASE` — a long random passphrase. Save it in your password manager; without it backups can't be decrypted.

Then run it once: Actions → "Weekly database backup" → Run workflow.

Note: GitHub disables scheduled workflows after 60 days with no repository activity — re-enable from the Actions tab if that happens.

**Restore** (download the artifact zip from the run and unzip it):

```bash
BACKUP_PASSPHRASE='…' openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
  -in expense-tracker-YYYY-MM-DD.dump.enc -out backup.dump -pass env:BACKUP_PASSPHRASE
pg_restore --list backup.dump                       # inspect
pg_restore --clean --if-exists --no-owner -d "$DIRECT_URL" backup.dump
```

This restores into the same Supabase project as-is. Every row references your login (`auth.users`) by id, so for a *new* project: run `npm run db:migrate`, sign in once (creating your user), then restore with `pg_restore --data-only` after replacing the old user id with the new one in the dump's data (e.g. restore into a scratch database, `update … set user_id = '<new id>'`, and copy across).

## Deploying (Vercel)

Import the GitHub repo in Vercel, set the env vars from `.env.example` (Production), keep the region `bom1` (`vercel.json`). Then in Supabase → Authentication → URL Configuration, set the Site URL to the Vercel URL and add `https://<your-app>.vercel.app/auth/callback` to Redirect URLs.

## Latency check

`GET /api/bench` runs three `select 1` queries and reports timings, region and whether the function was cold.
