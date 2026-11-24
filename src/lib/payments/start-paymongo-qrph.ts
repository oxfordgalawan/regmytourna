import { createAdminClient } from "@/lib/supabase/admin";
import { getAppUrl } from "@/lib/env/server";
import { createQrphPaymentSession } from "@/lib/services/paymongo/paymongo-qrph";
import { createCheckoutSession } from "@/lib/services/paymongo/paymongo-service";

export type StartRegistrationQrphResult = {
  qrImageUrl: string;
  paymentIntentId: string;
  expiresAt: string;
  checkoutUrl?: string;
};

export async function startRegistrationQrphPayment(opts: {
  registrationId: string;
  userId: string | null;
  tournamentId: string;
  tournamentName: string;
  tournamentSlug: string;
  amountCents: number;
  idempotencyKey: string;
  method?: "online" | "qr";
  recordedBy?: string | null;
  metadataExtra?: Record<string, string>;
  includeBrowserCheckout?: boolean;
  description?: string;
}): Promise<StartRegistrationQrphResult> {
  const appUrl = getAppUrl();
  const description =
    opts.description ?? `${opts.tournamentName} registration (non-refundable)`;
  const metadata: Record<string, string> = {
    registration_id: opts.registrationId,
    tournament_id: opts.tournamentId,
    ...(opts.userId ? { user_id: opts.userId } : {}),
    ...opts.metadataExtra,
  };

  const qr = await createQrphPaymentSession({
    amountCents: opts.amountCents,
    description,
    metadata,
    returnUrl: `${appUrl}/tournaments/${opts.tournamentSlug}/register/success?registration=${opts.registrationId}`,
  });

  let checkoutUrl: string | undefined;
  let checkoutSessionId: string | null = null;
  if (opts.includeBrowserCheckout !== false) {
    try {
      const checkout = await createCheckoutSession({
        amountCents: opts.amountCents,
        description,
        successUrl: `${appUrl}/tournaments/${opts.tournamentSlug}/register/success?registration=${opts.registrationId}`,
        cancelUrl: `${appUrl}/tournaments/${opts.tournamentSlug}`,
        metadata,
      });
      checkoutUrl = checkout.checkoutUrl;
      checkoutSessionId = checkout.sessionId;
    } catch {
      checkoutUrl = undefined;
    }
  }

  await createAdminClient().from("payments").insert({
    registration_id: opts.registrationId,
    user_id: opts.userId,
    amount_cents: opts.amountCents,
    currency: "PHP",
    status: "pending",
    method: opts.method ?? "online",
    recorded_by: opts.recordedBy ?? null,
    paymongo_payment_intent_id: qr.intentId,
    paymongo_qr_image_url: qr.qrImageUrl,
    qr_expires_at: qr.expiresAt,
    paymongo_checkout_session_id: checkoutSessionId,
    idempotency_key: opts.idempotencyKey,
  });

  return {
    qrImageUrl: qr.qrImageUrl,
    paymentIntentId: qr.intentId,
    expiresAt: qr.expiresAt,
    checkoutUrl,
  };
}