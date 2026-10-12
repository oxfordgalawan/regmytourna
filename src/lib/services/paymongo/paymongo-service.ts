import { createHmac, timingSafeEqual } from "crypto";
import { getServerEnv, isPayMongoConfigured } from "@/lib/env/server";

const PAYMONGO_API = "https://api.paymongo.com/v1";

function authHeader() {
  const key = getServerEnv().PAYMONGO_SECRET_KEY;
  if (!key) throw new Error("PayMongo secret key not configured");
  return `Basic ${Buffer.from(`${key}:`).toString("base64")}`;
}

export type CheckoutSessionResult = {
  checkoutUrl: string;
  sessionId: string;
};

export async function createCheckoutSession(params: {
  amountCents: number;
  description: string;
  successUrl: string;
  cancelUrl: string;
  metadata: Record<string, string>;
}): Promise<CheckoutSessionResult> {
  if (!isPayMongoConfigured()) {
    throw new Error(
      "PayMongo is not configured. Set PAYMONGO_SECRET_KEY, PAYMONGO_PUBLIC_KEY, and PAYMONGO_WEBHOOK_SECRET."
    );
  }

  const res = await fetch(`${PAYMONGO_API}/checkout_sessions`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      data: {
        attributes: {
          billing: null,
          send_email_receipt: true,
          show_description: true,
          show_line_items: true,
          line_items: [
            {
              amount: params.amountCents,
              currency: "PHP",
              name: params.description,
              quantity: 1,
            },
          ],
          payment_method_types: ["gcash", "grab_pay", "paymaya", "card"],
          success_url: params.successUrl,
          cancel_url: params.cancelUrl,
          metadata: params.metadata,
        },
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`PayMongo checkout failed: ${err.slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    data: { id: string; attributes: { checkout_url: string } };
  };
  return {
    sessionId: json.data.id,
    checkoutUrl: json.data.attributes.checkout_url,
  };
}

export function verifyPayMongoWebhookSignature(
  rawBody: string,
  signatureHeader: string | null
): boolean {
  const secret = getServerEnv().PAYMONGO_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return false;

  const parts = signatureHeader.split(",");
  const tPart = parts.find((p) => p.startsWith("t="));
  const v1Part = parts.find((p) => p.startsWith("v1="));
  if (!tPart || !v1Part) return false;

  const timestamp = tPart.slice(2);
  const signature = v1Part.slice(3);
  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  const sigBuf = Buffer.from(signature, "utf8");
  const expBuf = Buffer.from(expected, "utf8");
  if (sigBuf.length !== expBuf.length) return false;
  return timingSafeEqual(sigBuf, expBuf);
}
