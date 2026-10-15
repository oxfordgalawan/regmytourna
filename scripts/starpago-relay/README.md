# StarPago VPS relay (RegMyTourna)

RegMyTourna signs StarPago requests on Vercel; this service forwards them from a **fixed droplet IP** StarPago allowlists.

**Production hostname:** `https://starpago-relay.regmytourna.com`

Full droplet setup: [docs/STARPAGO_PRODUCTION.md](../../docs/STARPAGO_PRODUCTION.md) and [docs/STARPAGO_MERCHANT_REGISTRATION.md](../../docs/STARPAGO_MERCHANT_REGISTRATION.md).

## Update existing droplet (payout paths)

If payout fails with relay `400` / `invalid path`, the running relay is missing payout routes.

1. SSH to the relay droplet.
2. Replace `/opt/starpago-relay/server.mjs` with [server.mjs](./server.mjs) from this repo.
3. Restart: `sudo systemctl restart starpago-relay`
4. From your machine: `node --env-file=.env.local scripts/probe-relay-payout-path.mjs` — body must **not** be `invalid path`.

## Env on droplet (`/opt/starpago-relay/.env`)

| Variable | Example |
|----------|---------|
| `RELAY_SECRET` | Same as Vercel `STARPAGO_RELAY_SECRET` |
| `STARPAGO_API_HOST` | `ph.api.starpago.com` |
| `PORT` | `8787` (nginx proxies to this) |

## nginx

Typical: `location /` → `proxy_pass http://127.0.0.1:8787;`

## Bootstrap new droplet

On a fresh Ubuntu 24.04 droplet (after copying `server.mjs` and setting `.env`):

```bash
sudo bash scripts/starpago-relay/bootstrap-droplet.sh starpago-relay.regmytourna.com you@regmytourna.com
```

Run from a checkout on the server, or paste the script contents manually.
