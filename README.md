# Runway — FI & mortgage planner

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

## How data is stored
- One row per plan in `public.plans`; the whole plan is a JSON document in `data`.
- RLS: the owner, and any email listed in `shared_with`, can read and edit. Only the owner can delete or change sharing.
- Share with a partner from **Settings → Share this plan**. They sign in with Google using that email.
- Saves are debounced (~1s). Concurrent edits: last save wins.

## Model notes
- Annual steps, nominal dollars; dashboard FI figures are also shown in today's dollars.
- Tax and HECS per person using 2026–27 rates (editable under Plan inputs → Tax and HECS rates). Brackets stay fixed (bracket creep included); HECS thresholds index with inflation.
- Not modelled: tax on investment returns, fees, franking, LITO, Medicare levy surcharge, Paid Parental Leave, Family Tax Benefit, Age Pension, rate changes, sequence risk.
