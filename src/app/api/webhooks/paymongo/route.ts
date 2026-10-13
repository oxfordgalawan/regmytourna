import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPayMongoWebhookSignature } from "@/lib/services/paymongo/paymongo-service";
import { isPayMongoConfigured } from "@/lib/env/server";
import { creditOrganizerFromRegistration } from "@/lib/wallet/credit-organizer-from-payment";

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
  if (eventType === "checkout.session.payment.paid") {
    const metadata =
      payload.data.attributes.data?.attributes?.metadata ?? {};
    const registrationId = metadata.registration_id;
    if (registrationId) {
      // mark only the checkout that was paid (an entry can have several: an
      // abandoned online checkout plus a QR shown at the desk)
      const sessionId = payload.data.attributes.data?.id;
      const paidAt = new Date().toISOString();
      const { data: matched } = sessionId
        ? await admin
            .from("payments")
            .update({ status: "paid", paid_at: paidAt })
            .eq("registration_id", registrationId)
            .eq("paymongo_checkout_session_id", sessionId)
            .select("id")
        : { data: null };
      if (!matched?.length) {
        await admin
          .from("payments")
          .update({ status: "paid", paid_at: paidAt })
          .eq("registration_id", registrationId)
          .eq("status", "pending");
      }
      // other open checkouts for this entry can no longer be used
      await admin
        .from("payments")
        .update({ status: "cancelled" })
        .eq("registration_id", registrationId)
        .eq("status", "pending");

      await admin
        .from("registrations")
        .update({ status: "confirmed", payment_status: "paid" })
        .eq("id", registrationId);

      await creditOrganizerFromRegistration(admin, registrationId);
    }
  }

  return NextResponse.json({ ok: true });
}
