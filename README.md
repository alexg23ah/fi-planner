# Runway — FI planner and budget

Two apps behind one sign-in, switched from the menu next to the logo:
- **FI planner** — when you could stop working.
- **Budget** — import bank transactions, auto-categorise, track against monthly budgets.

A household financial-independence planner: three spending tiers (Minimum, Comfortable, Ideal), three return scenarios, mortgage and offset strategy, HECS, partner income, life events and work-pattern changes. Port of the `FI_Mortgage_Planner.xlsx` workbook; `src/model/engine.test.ts` checks the numbers match it.

Stack: Vite + React + TypeScript, Recharts, Supabase (Google sign-in + Postgres), hosted on Vercel.

## Setup

### 1. Supabase
1. Create a project at supabase.com.
2. **SQL Editor** → paste `supabase/migrations/001_plans.sql` → Run. This creates the `plans` table with row-level security.
3. **Authentication → Sign In / Providers → Google**: enable it and paste a Google OAuth client ID and secret.
   - In Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID (Web application).
   - Authorised redirect URI: `https://<your-project-ref>.supabase.co/auth/v1/callback` (shown on the Supabase Google provider page).
4. **Authentication → URL Configuration**: set Site URL to your Vercel URL (e.g. `https://fi-planner.vercel.app`) and add it, plus `http://localhost:5173`, to Redirect URLs.
5. **Project Settings → API**: copy the Project URL and the `anon` public key.

### 2. Vercel
1. New Project → import `alexg23ah/fi-planner`. Vercel detects Vite; keep the defaults.
2. Environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Deploy. Every push to `main` redeploys.

### Local development
```bash
cp .env.example .env.local   # fill in the two values
npm install
npm run dev                  # http://localhost:5173
npm test                     # model tests
```
Without the env vars the app runs in local-only mode (plan stored in the browser).

## Budget app setup
1. Supabase SQL Editor → run `supabase/migrations/002_budget.sql`, then `003_splits.sql` (after `001_plans.sql`).
2. AI categorising (optional): add **one** of these in Vercel → Environment Variables, then redeploy.
   - `GEMINI_API_KEY` — from aistudio.google.com → Get API key. Optional `GEMINI_MODEL` (default `gemini-3.5-flash-lite`).
   - or `AI_API_KEY` — any OpenAI-compatible key (Groq by default). Optional `AI_BASE_URL`, `AI_MODEL`.
   Gemini wins if both are set.

### How categorising works
1. Merchants you've categorised before (Setup → Remembered merchants). Your choices beat AI's.
2. Built-in keywords for common Australian merchants (`src/budget/defaults.ts`).
3. AI, only for merchants not matched above, only when you click the button. One line per merchant is sent: the cleaned name (card numbers, dates, references stripped) and in/out. No amounts, dates or account names. AI answers are remembered, so each merchant is only sent once.

### Splits
Type names (comma separated) in **Split with** on a transaction. It's shared equally between you and those people, only your share counts in the budget, and **Splits** shows what each person owes, with owed / requested / paid per item and a copyable request message. Money in whose description contains a split name is categorised as *Paid back by others* (a transfer, so not income).

Imports accept CommBank, NAB, Macquarie and Easy Street CSV exports, or rows pasted from internet banking. Re-importing overlapping data skips transactions already stored.

## How data is stored
- One row per plan in `public.plans`; the whole plan is a JSON document in `data`.
- RLS: the owner, and any email listed in `shared_with`, can read and edit. Only the owner can delete or change sharing.
- Share with a partner from **Settings → Share this plan**. They sign in with Google using that email.
- Saves are debounced (~1s). Concurrent edits: last save wins.

## Model notes
- Annual steps, nominal dollars; dashboard FI figures are also shown in today's dollars.
- Tax and HECS per person using 2026–27 rates (editable under Plan inputs → Tax and HECS rates). Brackets stay fixed (bracket creep included); HECS thresholds index with inflation.
- Not modelled: tax on investment returns, fees, franking, LITO, Medicare levy surcharge, Paid Parental Leave, Family Tax Benefit, Age Pension, rate changes, sequence risk.
