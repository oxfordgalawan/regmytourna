# StarPago — RegMyTourna production connectivity

**Not used for live registration payments until the merchant API is approved and integrated.** Today, entry payments use PayMongo ([PAYMENTS.md](./PAYMENTS.md)).

GCash / Maya / QR PH (when integrated) call StarPago from **Vercel serverless**. Outbound traffic uses a **DigitalOcean relay** with a fixed IPv4 StarPago allowlists.

Merchant registration checklist: [STARPAGO_MERCHANT_REGISTRATION.md](./STARPAGO_MERCHANT_REGISTRATION.md).

## 1. VPS relay

1. Confirm relay health: `https://starpago-relay.regmytourna.com/health` → `ok`
2. StarPago allowlists the droplet **public IPv4** (not Vercel egress).
3. Vercel env (Production and Staging/Preview as needed):

| Variable | Example / notes |
|----------|-----------------|
| `STARPAGO_RELAY_URL` | `https://starpago-relay.regmytourna.com` (no trailing slash) |
| `STARPAGO_RELAY_SECRET` | Same bearer secret as droplet `RELAY_SECRET` |

When `STARPAGO_RELAY_URL` is set, [`src/lib/starpago.ts`](../src/lib/starpago.ts) routes create/query/balance through `/forward?path=…`. Signing stays on Vercel; the relay does not hold merchant credentials.

**Allowlisted paths on the droplet** (see [server.mjs](../scripts/starpago-relay/server.mjs)):

- Pay-in: `/api/v2/payment/order/create`, `/api/v2/payment/order/query`
- Balance: `/api/v2/merchant/balance`
- Payout: `/api/v2/payout/order/create`, `/api/v2/payout/order/query`

After deploy:

```bash
node --env-file=.env.local scripts/probe-relay-payout-path.mjs
node --env-file=.env.local scripts/verify-starpago-relay.mjs
```

Checklist:

- [ ] Relay `/health` OK
- [ ] StarPago confirmed relay IP allowlisted
- [ ] `STARPAGO_RELAY_URL` + `STARPAGO_RELAY_SECRET` on Vercel, redeployed

## 2. Inbound callbacks (Vercel, not relay)

| Callback | URL |
|----------|-----|
| Pay-in notify | `{NEXT_PUBLIC_APP_URL}/api/starpago/notify` |
| Payout notify | `{NEXT_PUBLIC_APP_URL}/api/starpago/payout-notify` |

IP allowlist: `STARPAGO_CALLBACK_IPS` (default `54.151.137.174`). Confirm with StarPago support.

## 3. Vercel environment variables

| Variable | Staging (Preview) | Production |
|----------|-------------------|------------|
| `NEXT_PUBLIC_APP_URL` | `https://staging.regmytourna.com` | `https://www.regmytourna.com` |
| `STARPAGO_RELAY_URL` | `https://starpago-relay.regmytourna.com` | Same |
| `STARPAGO_RELAY_SECRET` | Same as droplet | Same |
| `STARPAGO_APP_ID` | Staging appId | Production appId |
| `STARPAGO_APP_SECRET` | Staging secret | Production secret |
| `STARPAGO_API_URL` | `https://ph.api.starpago.com` | Same |
| `STARPAGO_CALLBACK_IPS` | `54.151.137.174` | Same |

Redeploy after changing env vars.

Set these in Vercel → Project **regmytourna** → Settings → Environment Variables (this repo does not store production secrets). Copy-paste checklist: [VERCEL_STARPAGO_ENV.md](./VERCEL_STARPAGO_ENV.md).

## 4. Verification from laptop

```powershell
curl.exe -sS https://starpago-relay.regmytourna.com/health
curl.exe -sS https://www.regmytourna.com/api/starpago/notify
curl.exe -sS https://staging.regmytourna.com/api/starpago/notify
```

Unauthorized relay forward should return `401`:

```powershell
curl.exe -sS -o NUL -w "%{http_code}" "https://starpago-relay.regmytourna.com/forward?path=/api/v2/merchant/balance"
```

After allowlist is active, balance probe from app code or a future HQ diagnostic should return JSON (`code: 0`), not HTML 403.
