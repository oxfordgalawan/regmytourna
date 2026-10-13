# RegMyTourna

Tournament registration and management platform for pickleball (multi-sport ready): public listings, Supabase auth, PayMongo payments, Challonge OAuth sync, live scoring, and organizer tools.

## Stack

- Next.js (App Router) · TypeScript · Tailwind · shadcn/ui
- Supabase (Postgres, Auth, RLS)
- PayMongo · Challonge API v2.1 · Resend

## Local setup

1. **Clone and install**

   ```bash
   npm install
   cp .env.example .env.local
   ```

2. **Supabase**

   - Project **regmytourna** (`bfnnsqxlngsrnyqxbrpb`, ap-northeast-2).
   - Copy URL, anon key, and **service role** key from [Dashboard → Settings → API](https://supabase.com/dashboard/project/bfnnsqxlngsrnyqxbrpb/settings/api) into `.env.local`.
   - Remote schema is applied via Supabase migrations (`core_schema*` + RLS). To re-apply locally:

     ```bash
     npx supabase link --project-ref bfnnsqxlngsrnyqxbrpb
     npx supabase db push
     ```

   - **Philippine places (PSGC):** After migrations that create `ph_places`, build flattened rows and seed the reference table (see [`data/psgc/SOURCE.md`](data/psgc/SOURCE.md)):

     ```bash
     npx tsx scripts/build-ph-places.ts
     npx tsx scripts/seed-ph-places.ts
     ```

     Signup and **Settings → Profile** use optional city/barangay autocomplete backed by this table (`place_psgc_code` on `profiles`). Future tournament filters can reuse the same codes instead of free-text cities.

   - **Auth URLs** (Dashboard → Authentication → URL configuration):
     - Site URL: `https://www.regmytourna.com` (and `http://localhost:3000` for local dev)
     - Redirect URLs: `https://www.regmytourna.com/auth/callback`, `http://localhost:3000/auth/callback`

   - Enable Email auth (and optional Google) in Authentication → Providers.
   - Set Site URL to `http://localhost:3000` and redirect URLs to include `/auth/callback`.

3. **Challonge OAuth**

   - Create an app at [connect.challonge.com](https://connect.challonge.com).
   - Redirect URI: `{NEXT_PUBLIC_APP_URL}/api/integrations/challonge/callback`
   - Set `CHALLONGE_CLIENT_ID`, `CHALLONGE_CLIENT_SECRET`, `CHALLONGE_REDIRECT_URI`.
   - Generate a 32-byte key: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` → `CHALLONGE_TOKEN_ENCRYPTION_KEY`.

4. **PayMongo**

   - Dashboard keys → `PAYMONGO_SECRET_KEY`, `PAYMONGO_PUBLIC_KEY`.
   - Webhook URL: `{NEXT_PUBLIC_APP_URL}/api/webhooks/paymongo` → `PAYMONGO_WEBHOOK_SECRET`.
   - Event: `checkout.session.payment.paid`.
   - **`PLATFORM_FEE_PERCENT`** (default `5`): platform fee on entry payments; the rest credits the tournament owner’s **organizer wallet** at `/organizer/wallet`. Funds still settle to your PayMongo account (ledger only in v1).
   - **`MIN_WITHDRAWAL_CENTS`** (optional, default `10000` = ₱100): minimum amount for a wallet withdrawal request.
   - Backfill wallet credits for older paid rows: `npx tsx scripts/backfill-organizer-wallets.ts`.

## Organizer wallet & withdrawals

- **Balance:** Available balance is spendable; pending withdrawal amounts are held until a super admin approves or rejects the request.
- **Payout methods:** Organizers save up to three GCash, Maya, bank, or other methods on `/organizer/wallet` and can copy all details for their records.
- **Withdrawals:** Submit a request from the wallet page. Funds move from available to pending; a super admin reviews at `/super-admin/withdrawals`, copies payout details for manual transfer outside the app, then approves or rejects. Rejection restores available balance.
- **Registration QR:** On each event overview (`/organizer/tournaments/[id]`), **Share registration** generates a QR and link to `{NEXT_PUBLIC_APP_URL}/tournaments/{slug}#register` (copy link or download PNG).

5. **Resend** (optional)

   - `RESEND_API_KEY` for partner invites and confirmation emails.

6. **Run**

   ```bash
   npm run dev
   ```

## Demo data

After signing up as an organizer, insert demo tournaments via SQL or the create-tournament UI. Mark demo rows with `is_demo = true`.

## Deployment (Vercel)

- Set all env vars from `.env.example`.
- Connect Supabase; run migrations on production DB.
- Configure Challonge and PayMongo webhooks to production URLs.

## Missing credentials

Integrations fail with clear UI/messages — the app does **not** simulate successful payments or OAuth when keys are absent.

## Roles (three kinds)

| Role | Where it lives | Who sets it | App behavior |
|------|----------------|-------------|--------------|
| **Super admin** | Supabase Auth `app_metadata.role = super_admin` | Dashboard or service role only | `/super-admin` after login |
| **Organizer** | `profiles.account_type = organizer` | Signup or profile | Organizer tools, can own tournaments |
| **Player** | `profiles.account_type = player` | Signup (default) | Player dashboard, registrations |

Super admin is a **platform** role (not a signup option). Organizers and players are **account types** on `profiles`. A super admin can still use player and organizer UIs via the console shortcuts.

## Create a super admin in Supabase (recommended)

1. [Dashboard → Authentication → Users](https://supabase.com/dashboard/project/bfnnsqxlngsrnyqxbrpb/auth/users) → **Add user** → **Create new user**.
2. Email + password, turn on **Auto confirm user**.
3. Under **App metadata** (raw JSON), set: `{ "role": "super_admin" }`.
4. Optional **User metadata**: `{ "full_name": "Your Name", "account_type": "organizer" }` so the profile trigger gets a name and organizer access.
5. Ensure a row exists in **public.profiles** (usually created by the signup trigger; if missing, insert matching `id` from Auth).

Sign in at `/login` → redirect to `/super-admin`.

Optional CLI (same Auth Admin API as the Dashboard): `scripts/create-super-admin.ts` with `SUPER_ADMIN_*` env vars — do not commit passwords.

## Scripts

- `npm run dev` — development server
- `npm run build` — production build
- `npm run lint` — ESLint
