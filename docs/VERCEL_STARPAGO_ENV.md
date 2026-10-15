# Vercel — StarPago environment variables

Project: **regmytourna** → Settings → Environment Variables.

After adding or changing values, **redeploy** Production and Preview (staging).

## Production

| Name | Value |
|------|--------|
| `NEXT_PUBLIC_APP_URL` | `https://www.regmytourna.com` |
| `STARPAGO_RELAY_URL` | `https://starpago-relay.regmytourna.com` |
| `STARPAGO_RELAY_SECRET` | Same as droplet `RELAY_SECRET` (password manager) |
| `STARPAGO_APP_ID` | Production merchant appId (32 chars) |
| `STARPAGO_APP_SECRET` | Production app secret |
| `STARPAGO_API_URL` | `https://ph.api.starpago.com` |
| `STARPAGO_CALLBACK_IPS` | `54.151.137.174` (confirm with StarPago) |

## Preview / staging

Assign to **Preview** (or a dedicated Preview branch for `staging.regmytourna.com`):

| Name | Value |
|------|--------|
| `NEXT_PUBLIC_APP_URL` | `https://staging.regmytourna.com` |
| `STARPAGO_RELAY_URL` | `https://starpago-relay.regmytourna.com` (same droplet) |
| `STARPAGO_RELAY_SECRET` | Same as Production |
| `STARPAGO_APP_ID` | Staging merchant appId |
| `STARPAGO_APP_SECRET` | Staging app secret |
| `STARPAGO_API_URL` | `https://ph.api.starpago.com` |
| `STARPAGO_CALLBACK_IPS` | `54.151.137.174` |

## CLI (optional)

If [Vercel CLI](https://vercel.com/docs/cli) is installed and linked:

```bash
vercel env add STARPAGO_RELAY_URL production
vercel env add STARPAGO_RELAY_SECRET production
# … repeat for each variable and environment
vercel --prod
```

Do not commit secrets to git.
