import { getServerEnv, isPayMongoConfigured } from "@/lib/env/server";
import { resolveWalletInstantSettlement } from "@/lib/services/paymongo/paymongo-wallet-settlement";

const PAYMONGO_API = "https://api.paymongo.com/v1";

function authHeader() {
  const key = getServerEnv().PAYMONGO_SECRET_KEY;
  if (!key) throw new Error("PayMongo secret key not configured");
  return `Basic ${Buffer.from(`${key}:`).toString("base64")}`;
}

type PaymongoPaymentAttrs = {
  status?: string;
  amount?: number;
  fee?: number;
  net_amount?: number;
};

function settlementFromPaymentAttrs(attrs: PaymongoPaymentAttrs | undefined): number | null {
  if (!attrs || attrs.status !== "paid") return null;
  const amount = attrs.amount;
  if (typeof amount !== "number" || amount < 0) return null;
  if (typeof attrs.net_amount === "number" && attrs.net_amount >= 0) {
    return attrs.net_amount;
  }
  const fee = typeof attrs.fee === "number" && attrs.fee >= 0 ? attrs.fee : 0;
  return Math.max(0, amount - fee);
}

function pickBestSettlement(
  payments: Array<{ attributes?: PaymongoPaymentAttrs }> | undefined,
  grossCents?: number
): { settlementCents: number; paymongoFeeCents: number } | null {
  if (!payments?.length) return null;
  const paid = payments
    .map((p) => p.attributes)
    .filter((a): a is PaymongoPaymentAttrs => a?.status === "paid");
  if (!paid.length) return null;

  const chosen =
    grossCents !== undefined
      ? paid.find((p) => p.amount === grossCents) ?? paid[paid.length - 1]
      : paid[paid.length - 1];

  const settlement = settlementFromPaymentAttrs(chosen);
  if (settlement === null) return null;
  const gross = chosen.amount ?? settlement;
  const paymongoFee = Math.max(0, gross - settlement);
  return { settlementCents: settlement, paymongoFeeCents: paymongoFee };
}

async function resolvePaymentIntentSettlement(opts: {
  intentId?: string | null;
  sessionId?: string | null;
  grossCents?: number;
}): Promise<{ settlementCents: number; paymongoFeeCents: number } | null> {
  const intentId = opts.intentId?.trim();
  const sessionId = opts.sessionId?.trim();

  try {
    if (intentId) {
      const res = await fetch(`${PAYMONGO_API}/payment_intents/${encodeURIComponent(intentId)}`, {
        headers: { Authorization: authHeader() },
        cache: "no-store",
      });
      if (!res.ok) return null;
      const json = (await res.json()) as {
        data?: {
          attributes?: {
            amount?: number;
            payments?: Array<{ attributes?: PaymongoPaymentAttrs }>;
          };
        };
      };
      const fromPayments = pickBestSettlement(json.data?.attributes?.payments, opts.grossCents);
      if (fromPayments) return fromPayments;
      const gross = json.data?.attributes?.amount;
      if (typeof gross === "number") {
        return { settlementCents: gross, paymongoFeeCents: 0 };
      }
    }

    if (sessionId) {
      const res = await fetch(`${PAYMONGO_API}/checkout_sessions/${encodeURIComponent(sessionId)}`, {
        headers: { Authorization: authHeader() },
        cache: "no-store",
      });
      if (!res.ok) return null;
      const json = (await res.json()) as {
        data?: {
          attributes?: {
            payments?: Array<{ attributes?: PaymongoPaymentAttrs }>;
            payment_intent?: { attributes?: { payments?: Array<{ attributes?: PaymongoPaymentAttrs }> } };
          };
        };
      };
      const fromSession = pickBestSettlement(json.data?.attributes?.payments, opts.grossCents);
      if (fromSession) return fromSession;
      const fromIntent = pickBestSettlement(
        json.data?.attributes?.payment_intent?.attributes?.payments,
        opts.grossCents
      );
      if (fromIntent) return fromIntent;
    }
  } catch {
    return null;
  }

  return null;
}

export async function resolvePaymongoSettlement(opts: {
  intentId?: string | null;
  sessionId?: string | null;
  grossCents?: number;
  paidAt?: string | null;
  useWalletInstantSettlement?: boolean;
}): Promise<{ settlementCents: number; paymongoFeeCents: number } | null> {
  if (!isPayMongoConfigured()) return null;

  const paymentNet = await resolvePaymentIntentSettlement(opts);

  if (!opts.useWalletInstantSettlement) {
    return paymentNet;
  }

  const walletNet = await resolveWalletInstantSettlement({
    intentId: opts.intentId,
    grossCents: opts.grossCents,
    paidAt: opts.paidAt,
  });

  if (walletNet && paymentNet) {
    if (walletNet.settlementCents <= paymentNet.settlementCents) {
      return walletNet;
    }
    console.warn(
      "paymongo_settlement: wallet instant net exceeds payment net; using payment net",
      { wallet: walletNet.settlementCents, payment: paymentNet.settlementCents }
    );
    return paymentNet;
  }

  return walletNet ?? paymentNet;
}