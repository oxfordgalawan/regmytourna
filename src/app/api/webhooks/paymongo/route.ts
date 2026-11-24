import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPayMongoWebhookSignature } from "@/lib/services/paymongo/paymongo-service";
import { isPayMongoConfigured } from "@/lib/env/server";
import { settlePaidCheckout, settlePaidIntent } from "@/lib/payments/settle";

export async function POST(request: NextRequest) {
  if (!isPayMongoConfigured()) {
    return NextResponse.json({ error: "PayMongo not configured" }, { status: 503 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("paymongo-signature");
  if (!verifyPayMongoWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody) as {
    data: {
      id: string;
      attributes: {
        type: string;
        data?: {
          id?: string;
          attributes?: {
            metadata?: Record<string, string>;
            status?: string;
            payment_intent_id?: string;
          };
        };
      };
    };
  };

  const eventId = payload.data.id;
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("payment_webhook_events")
    .select("id")
    .eq("external_event_id", eventId)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  await admin.from("payment_webhook_events").insert({
    external_event_id: eventId,
    event_type: payload.data.attributes.type,
    payload,
    processed_at: new Date().toISOString(),
  });

  const eventType = payload.data.attributes.type;
  const inner = payload.data.attributes.data;
  const metadata = inner?.attributes?.metadata ?? {};
  const registrationId = metadata.registration_id;

  if (eventType === "checkout.session.payment.paid" && registrationId) {
    await settlePaidCheckout(registrationId, inner?.id ?? null);
  }

  const innerId = inner?.id ?? "";
  const intentFromPayload =
    innerId.startsWith("pi_")
      ? innerId
      : typeof inner?.attributes?.payment_intent_id === "string" &&
          inner.attributes.payment_intent_id.startsWith("pi_")
        ? inner.attributes.payment_intent_id
        : null;

  const paidByIntent =
    eventType === "payment_intent.succeeded" ||
    eventType === "payment.paid" ||
    (eventType?.startsWith("payment_intent.") && inner?.attributes?.status === "succeeded");

  if (paidByIntent) {
    let regId = registrationId;
    let intentId = intentFromPayload;
    if (!regId && intentId) {
      const { data: row } = await admin
        .from("payments")
        .select("registration_id")
        .eq("paymongo_payment_intent_id", intentId)
        .maybeSingle();
      regId = row?.registration_id ?? "";
    }
    if (!intentId && eventType === "payment_intent.succeeded" && innerId.startsWith("pi_")) {
      intentId = innerId;
    }
    if (regId && intentId) {
      await settlePaidIntent(regId, intentId);
    } else if (regId && eventType === "payment_intent.succeeded") {
      await settlePaidIntent(regId, innerId.startsWith("pi_") ? innerId : null);
    }
  }

  return NextResponse.json({ ok: true });
}
