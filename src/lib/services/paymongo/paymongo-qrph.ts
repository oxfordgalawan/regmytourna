import { getServerEnv, isPayMongoConfigured } from "@/lib/env/server";
import { ONLINE_PAYMENT_HOLD_MS } from "@/lib/registrations/payment-hold";

const PAYMONGO_API = "https://api.paymongo.com/v1";

/** Default QR Ph expiry — matches registration payment hold (30 min). */
export const QRPH_EXPIRY_SECONDS = Math.min(
  1800,
  Math.floor(ONLINE_PAYMENT_HOLD_MS / 1000)
);

export type QrphPaymentSession = {
  intentId: string;
  qrImageUrl: string;
  expiresAt: string;
};

type PaymongoError = {
  errors?: Array<{ detail?: string }>;
};

function authHeader() {
  const key = getServerEnv().PAYMONGO_SECRET_KEY;
  if (!key) throw new Error("PayMongo secret key not configured");
  return `Basic ${Buffer.from(`${key}:`).toString("base64")}`;
}

function extractQrImageUrl(attachJson: Record<string, unknown>): string | null {
  const attrs = (attachJson.data as { attributes?: Record<string, unknown> })?.attributes;
  const nextAction = attrs?.next_action as Record<string, unknown> | undefined;
  if (!nextAction) return null;

  const code = nextAction.code as { image_url?: string; content?: string } | undefined;
  if (code?.image_url) return code.image_url;
  if (typeof code?.content === "string" && code.content.trim()) return code.content.trim();

  const qrph = nextAction.qrph_image_url;
  if (typeof qrph === "string" && qrph.length > 0) return qrph;

  return null;
}

async function paymongoErrorDetail(res: Response): Promise<string> {
  try {
    const json = (await res.json()) as PaymongoError;
    const detail = json.errors?.[0]?.detail;
    if (detail) return detail;
    return `Payment request failed (HTTP ${res.status})`;
  } catch {
    return `Payment request failed (HTTP ${res.status})`;
  }
}

export async function createQrphPaymentSession(opts: {
  amountCents: number;
  description: string;
  metadata: Record<string, string>;
  returnUrl: string;
  expirySeconds?: number;
}): Promise<QrphPaymentSession> {
  if (!isPayMongoConfigured()) {
    throw new Error("PayMongo is not configured.");
  }
  const expirySeconds = opts.expirySeconds ?? QRPH_EXPIRY_SECONDS;
  const headers = {
    Authorization: authHeader(),
    "Content-Type": "application/json",
  };

  const piRes = await fetch(`${PAYMONGO_API}/payment_intents`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      data: {
        attributes: {
          amount: opts.amountCents,
          currency: "PHP",
          payment_method_allowed: ["qrph"],
          description: opts.description,
          metadata: opts.metadata,
        },
      },
    }),
  });

  if (!piRes.ok) {
    throw new Error(await paymongoErrorDetail(piRes));
  }

  const piJson = (await piRes.json()) as { data: { id: string } };
  const intentId = piJson.data.id;

  const pmRes = await fetch(`${PAYMONGO_API}/payment_methods`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      data: {
        attributes: {
          type: "qrph",
          expiry_seconds: expirySeconds,
        },
      },
    }),
  });

  if (!pmRes.ok) {
    throw new Error(await paymongoErrorDetail(pmRes));
  }

  const pmJson = (await pmRes.json()) as { data: { id: string } };

  const attachRes = await fetch(`${PAYMONGO_API}/payment_intents/${intentId}/attach`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      data: {
        attributes: {
          payment_method: pmJson.data.id,
          return_url: opts.returnUrl,
        },
      },
    }),
  });

  if (!attachRes.ok) {
    throw new Error(await paymongoErrorDetail(attachRes));
  }

  const attachJson = (await attachRes.json()) as Record<string, unknown>;
  const qrImageUrl = extractQrImageUrl(attachJson);
  if (!qrImageUrl) {
    throw new Error("QR code was not returned. Please try again.");
  }

  return {
    intentId,
    qrImageUrl,
    expiresAt: new Date(Date.now() + expirySeconds * 1000).toISOString(),
  };
}

export async function isPaymentIntentPaid(intentId: string): Promise<boolean> {
  if (!isPayMongoConfigured() || !intentId) return false;
  try {
    const res = await fetch(`${PAYMONGO_API}/payment_intents/${encodeURIComponent(intentId)}`, {
      headers: { Authorization: authHeader() },
      cache: "no-store",
    });
    if (!res.ok) return false;
    const json = (await res.json()) as {
      data?: {
        attributes?: {
          status?: string;
          payments?: Array<{ attributes?: { status?: string } }>;
        };
      };
    };
    const a = json.data?.attributes;
    if (a?.status === "succeeded") return true;
    return Boolean(a?.payments?.some((p) => p.attributes?.status === "paid"));
  } catch {
    return false;
  }
}