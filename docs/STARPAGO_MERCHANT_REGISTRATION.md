# StarPago merchant registration — RegMyTourna

Use this when submitting the **new** merchant/API account form (separate from DoGoGo).

## Domains and DNS

| Role | URL / hostname |
|------|----------------|
| Production app | `https://www.regmytourna.com` |
| Staging app | `https://staging.regmytourna.com` |
| Relay (HTTPS) | `starpago-relay.regmytourna.com` |

**DNS (at your registrar / Cloudflare):**

| Type | Name | Value | Notes |
|------|------|-------|--------|
| A | `starpago-relay` | `RELAY_PUBLIC_IP` | DigitalOcean droplet public IPv4 |
| CNAME or Vercel | `www` | Vercel production | As already configured |
| CNAME or Vercel | `staging` | Vercel staging/preview | Must match `NEXT_PUBLIC_APP_URL` on Preview |

Deploy staging **before** submitting the form so callback URLs respond (GET `/api/starpago/notify` → `ok` when env is set).

---

## C) Public IPv4 table (registration form)

Use **one droplet** — same IPv4 in all four fields (provider confirmed duplicate staging/production is OK).

| Form field | Droplet | Public IPv4 | Notes |
|------------|---------|-------------|--------|
| API IP Staging | `regmytourna-starpago-relay` | _paste from DO Networking_ | Outbound API via relay |
| API IP Production | same | _same_ | |
| BO IP Staging | same | _same_ | Same as API when HQ is on Vercel + relay |
| BO IP Production | same | _same_ | |

---

## D) Callback URL table

| Form field | Full URL |
|------------|----------|
| Staging Callback URL | `https://staging.regmytourna.com/api/starpago/notify` |
| Production Callback URL | `https://www.regmytourna.com/api/starpago/notify` |

**Payout notify (not always on the form):** configure with support or merchant portal if available:

- Staging: `https://staging.regmytourna.com/api/starpago/payout-notify`
- Production: `https://www.regmytourna.com/api/starpago/payout-notify`

Pay-in create/send uses `notifyUrl` in API body; payout create uses `payout-notify` when you integrate withdrawals.

---

## F) Provider ticket (copy after form)

**Subject:** Allowlist server egress IP — RegMyTourna Philippines API (new merchant)

```text
We operate RegMyTourna (tournament registration) on Vercel with a fixed-IP HTTPS relay for outbound API calls.

API host: https://ph.api.starpago.com

Please allowlist this egress IPv4 for API access (staging + production merchant accounts if separate):
  RELAY_PUBLIC_IP

Paths used:
  POST /api/v2/payment/order/create
  GET  /api/v2/payment/order/query
  GET  /api/v2/merchant/balance
  POST /api/v2/payout/order/create
  GET  /api/v2/payout/order/query

Pay-in async notify (staging):
  https://staging.regmytourna.com/api/starpago/notify
Pay-in async notify (production):
  https://www.regmytourna.com/api/starpago/notify

Payout async notify (if applicable):
  https://staging.regmytourna.com/api/starpago/payout-notify
  https://www.regmytourna.com/api/starpago/payout-notify

Please confirm inbound notify source IP(s) for our allowlist (we use STARPAGO_CALLBACK_IPS, default 54.151.137.174).

Can you confirm Cloudflare/WAF is not blocking datacenter IPs for our merchant account?
```

Replace `RELAY_PUBLIC_IP` after creating the DigitalOcean droplet.

---

## Droplet create (DigitalOcean console)

1. **Create → Droplets**
2. Region: **Singapore (SGP1)**
3. Image: **Ubuntu 24.04 LTS**
4. Size: **Basic $6/mo** (1 vCPU / 1 GB)
5. Authentication: **SSH key**
6. Hostname: `regmytourna-starpago-relay`
7. Copy **Public IPv4** → DNS A record for `starpago-relay.regmytourna.com`

### Deploy relay (from laptop)

Generate secret (store in password manager; same value on droplet + Vercel):

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

```powershell
scp "scripts/starpago-relay/server.mjs" root@RELAY_PUBLIC_IP:/opt/starpago-relay/
```

On droplet, create `/opt/starpago-relay/.env` with `RELAY_SECRET`, `STARPAGO_API_HOST=ph.api.starpago.com`, `PORT=8787`, then run [bootstrap-droplet.sh](../scripts/starpago-relay/bootstrap-droplet.sh) or follow [STARPAGO_PRODUCTION.md](./STARPAGO_PRODUCTION.md).
