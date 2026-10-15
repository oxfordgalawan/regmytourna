# Transactional email (Resend)

RegMyTourna sends registration, partner, and petition emails via [Resend](https://resend.com) from [`src/lib/email/send.ts`](../src/lib/email/send.ts).

## Resend dashboard (once per domain)

1. **Domains** → Add **regmytourna.com**.
2. Add the DNS records Resend shows (usually SPF + DKIM; may include a verification TXT).
3. Wait until the domain shows **Verified**.
4. **API Keys** → Create key → copy `re_…` (shown once).

Without a verified domain, sending from `info@regmytourna.com` will fail in production. For quick tests only, Resend’s sandbox `onboarding@resend.dev` works to your own verified recipient addresses — the app default is now **`info@regmytourna.com`**, so verify the domain before testing real sends.

## Environment variables

| Variable | Required | Local (`.env.local`) | Vercel Production | Vercel Preview |
|----------|----------|----------------------|-------------------|----------------|
| `RESEND_API_KEY` | Yes, to send mail | Same `re_…` key or a separate test key | Production API key | Same as prod or a test key |
| `RESEND_FROM` | No | Omit to use default below | Same | Same |

**Default sender** (if `RESEND_FROM` is unset):

```text
RegMyTourna <info@regmytourna.com>
```

**Example `.env.local`:**

```env
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxx
# RESEND_FROM=RegMyTourna <info@regmytourna.com>
```

**Vercel:** Project → **Settings** → **Environment Variables** → add `RESEND_API_KEY` (mark **Sensitive**) for **Production** (and **Preview** if staging should send mail). Redeploy after changes.

Optional override:

```env
RESEND_FROM=RegMyTourna <info@regmytourna.com>
```

Use the exact format `Display Name <email@domain.com>`.

## Related env (not Resend)

Emails link to your site using `NEXT_PUBLIC_APP_URL` — set that to your real URL on Vercel (e.g. `https://www.regmytourna.com`) so links in emails are correct.

## Password reset emails

When `RESEND_API_KEY` is set, forgot-password uses **Resend** with the branded template in [`password-reset-email.ts`](../src/lib/email/password-reset-email.ts) (same look as registration mail). Links go through `/auth/callback?next=/reset-password`.

If Resend is not configured, Supabase sends its default recovery email instead (customize under **Authentication → Email templates** in Supabase).

**Supabase redirect allowlist:** Dashboard → **Authentication → URL configuration** → add:

- `{NEXT_PUBLIC_APP_URL}/auth/callback`
- `{NEXT_PUBLIC_APP_URL}/reset-password` (optional; callback is the important one)

Other Supabase Auth emails (confirm signup, magic link) still use Supabase templates unless you add custom SMTP in Supabase.
