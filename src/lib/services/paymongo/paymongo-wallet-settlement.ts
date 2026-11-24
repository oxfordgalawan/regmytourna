import { paymongoPayoutSecretKey, paymongoWalletConfigured } from "@/lib/services/paymongo/paymongo-env";

const PAYMONGO_API = "https://api.paymongo.com/v1";

type WalletTxAttrs = {
  amount?: number;
  net_amount?: number;
  status?: string;
  type?: string;
  reference_number?: string;
  created_at?: number;
};

function walletAuthHeader() {
  const key = paymongoPayoutSecretKey();
  if (!key) throw new Error("PayMongo wallet secret not configured");
  return `Basic ${Buffer.from(`${key}:`).toString("base64")}`;
}

async function fetchMerchantWalletId(): Promise<string | null> {
  const res = await fetch(`${PAYMONGO_API}/wallets`, {
    headers: { Authorization: walletAuthHeader() },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    data?: Array<{ id?: string }>;
  };
  return json.data?.[0]?.id ?? null;
}

function isIncomingWalletTx(attrs: WalletTxAttrs | undefined): boolean {
  if (!attrs || attrs.status !== "succeeded") return false;
  const t = (attrs.type ?? "").toLowerCase();
  return t === "cash_in" || t === "receive_money" || t === "receive";
}

function walletCreditCents(attrs: WalletTxAttrs): number | null {
  if (typeof attrs.net_amount === "number" && attrs.net_amount >= 0) {
    return attrs.net_amount;
  }
  if (typeof attrs.amount === "number" && attrs.amount >= 0) {
    return attrs.amount;
  }
  return null;
}

function pickWalletReceiveTx(
  rows: Array<{ attributes?: WalletTxAttrs }>,
  opts: {
    intentId?: string | null;
    grossCents?: number;
    paidAt?: string | null;
  }
): number | null {
  const intentNeedle = opts.intentId?.trim().toLowerCase();
  const paidMs = opts.paidAt ? Date.parse(opts.paidAt) : NaN;
  const gross = opts.grossCents;

  let best: { score: number; cents: number } | null = null;

  for (const row of rows) {
    const attrs = row.attributes;
    if (!isIncomingWalletTx(attrs)) continue;
    const cents = walletCreditCents(attrs ?? {});
    if (cents === null) continue;
    if (gross !== undefined && cents > gross) continue;

    let score = 0;
    const ref = (attrs?.reference_number ?? "").toLowerCase();
    if (intentNeedle && ref.includes(intentNeedle)) score += 100;
    if (gross !== undefined && Math.abs(cents - gross) <= gross * 0.03) score += 20;

    const created = attrs?.created_at;
    if (!Number.isNaN(paidMs) && typeof created === "number") {
      const delta = Math.abs(created * 1000 - paidMs);
      if (delta <= 30 * 60 * 1000) score += 40;
      else if (delta <= 24 * 60 * 60 * 1000) score += 10;
    }

    if (!best || score > best.score || (score === best.score && cents < best.cents)) {
      best = { score, cents };
    }
  }

  return best?.cents ?? null;
}

/** Net credited to the PayMongo merchant wallet after Instant Settlement (if enabled). */
export async function resolveWalletInstantSettlement(opts: {
  intentId?: string | null;
  grossCents?: number;
  paidAt?: string | null;
}): Promise<{ settlementCents: number; paymongoFeeCents: number } | null> {
  if (!paymongoWalletConfigured()) return null;
  const grossCents = opts.grossCents;
  if (grossCents === undefined || grossCents <= 0) return null;

  try {
    const walletId = await fetchMerchantWalletId();
    if (!walletId) return null;

    const params = new URLSearchParams({ limit: "100" });
    if (opts.paidAt) {
      const after = new Date(opts.paidAt);
      after.setMinutes(after.getMinutes() - 10);
      params.set("created_after", after.toISOString());
    }

    const res = await fetch(
      `${PAYMONGO_API}/wallets/${encodeURIComponent(walletId)}/wallet_transactions?${params}`,
      {
        headers: { Authorization: walletAuthHeader() },
        cache: "no-store",
      }
    );
    if (!res.ok) return null;

    const json = (await res.json()) as {
      data?: Array<{ attributes?: WalletTxAttrs }>;
    };
    const settlementCents = pickWalletReceiveTx(json.data ?? [], opts);
    if (settlementCents === null) return null;

    return {
      settlementCents,
      paymongoFeeCents: Math.max(0, grossCents - settlementCents),
    };
  } catch {
    return null;
  }
}