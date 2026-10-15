/**
 * Quick relay + callback URL checks from your laptop.
 * Usage: node --env-file=.env.local scripts/verify-starpago-relay.mjs
 */
const relay = process.env.STARPAGO_RELAY_URL?.replace(/\/$/, "");
const secret = process.env.STARPAGO_RELAY_SECRET?.trim();
const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");

let failed = 0;

async function check(name, fn) {
  try {
    await fn();
    console.log(`OK  ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`FAIL ${name}:`, err instanceof Error ? err.message : err);
  }
}

if (relay) {
  await check("relay /health", async () => {
    const res = await fetch(`${relay}/health`);
    const text = await res.text();
    if (!res.ok || text.trim() !== "ok") {
      throw new Error(`expected ok, got ${res.status} ${text.slice(0, 80)}`);
    }
  });

  await check("relay forward unauthorized → 401", async () => {
    const res = await fetch(
      `${relay}/forward?path=${encodeURIComponent("/api/v2/merchant/balance")}`,
    );
    if (res.status !== 401) {
      throw new Error(`expected 401, got ${res.status}`);
    }
  });

  if (secret) {
    await check("relay payout path not blocked", async () => {
      const res = await fetch(
        `${relay}/forward?path=${encodeURIComponent("/api/v2/payout/order/create")}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${secret}`,
            "Content-Type": "application/json",
          },
          body: "{}",
        },
      );
      const text = await res.text();
      if (text.trim() === "invalid path") {
        throw new Error("invalid path — update ALLOWED_PATHS on droplet");
      }
    });
  } else {
    console.warn("SKIP relay forward probe (no STARPAGO_RELAY_SECRET)");
  }
} else {
  console.warn("SKIP relay checks (no STARPAGO_RELAY_URL)");
}

if (appUrl) {
  await check("pay-in notify GET", async () => {
    const res = await fetch(`${appUrl}/api/starpago/notify`);
    if (res.status === 404) {
      throw new Error("route missing — deploy latest app");
    }
    if (res.status === 503) {
      console.log(
        "     (503 = route live; set STARPAGO_APP_ID + STARPAGO_APP_SECRET for plain ok)",
      );
      return;
    }
    const text = await res.text();
    if (res.status !== 200 || text.trim() !== "ok") {
      throw new Error(`expected 200 ok, got ${res.status} ${text.slice(0, 80)}`);
    }
  });
} else {
  console.warn("SKIP callback check (no NEXT_PUBLIC_APP_URL)");
}

process.exit(failed > 0 ? 1 : 0);
