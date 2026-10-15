/**
 * Checks whether the VPS relay allowlists payout create (not "invalid path").
 * Usage: node --env-file=.env.local scripts/probe-relay-payout-path.mjs
 */
const relay = process.env.STARPAGO_RELAY_URL?.replace(/\/$/, "");
const secret = process.env.STARPAGO_RELAY_SECRET?.trim();

if (!relay || !secret) {
  console.error("Set STARPAGO_RELAY_URL and STARPAGO_RELAY_SECRET");
  process.exit(1);
}

const url = `${relay}/forward?path=${encodeURIComponent("/api/v2/payout/order/create")}`;
const res = await fetch(url, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${secret}`,
    "Content-Type": "application/json",
  },
  body: "{}",
});
const text = await res.text();
const snippet = text.slice(0, 200);

console.log("status:", res.status);
console.log("body:", snippet);

if (text.trim() === "invalid path") {
  console.error(
    "FAIL: relay still blocks /api/v2/payout/order/create — update droplet ALLOWED_PATHS (see scripts/starpago-relay/README.md)",
  );
  process.exit(1);
}

if (snippet.startsWith("{") || snippet.includes('"code"')) {
  console.log("OK: relay forwarded to StarPago (JSON response).");
  process.exit(0);
}

console.log("OK: relay did not return invalid path (check status/body above).");
process.exit(0);
