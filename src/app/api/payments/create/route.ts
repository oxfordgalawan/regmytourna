import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { startRegistrationQrphPayment } from "@/lib/payments/start-paymongo-qrph";
import { isPayMongoConfigured } from "@/lib/env/server";
import { relationOne } from "@/lib/supabase/relations";
import { isCaptainOf } from "@/lib/registrations/team-changes";
import { getRegistrationMode } from "@/lib/tournaments/mode";

export async function POST(request: NextRequest) {
  if (!isPayMongoConfigured()) {
    return NextResponse.json(
      { error: "PayMongo is not configured. See README." },
      { status: 503 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as { registrationId?: string };
  if (!body.registrationId) {
    return NextResponse.json({ error: "registrationId required" }, { status: 400 });
  }

  const { data: registration } = await supabase
    .from("registrations")
    .select("id, tournament_id, division_id, registered_by, status, payment_status, tournaments(name, slug, entry_fee_cents), tournament_divisions(entry_fee_cents)")
    .eq("id", body.registrationId)
    .single();

  if (!registration || !(await isCaptainOf(registration.id, user.id))) {
    return NextResponse.json({ error: "Registration not found" }, { status: 404 });
  }
  if ((await getRegistrationMode(registration.tournament_id)) === "bracket_only") {
    return NextResponse.json({ error: "This event doesn't take payments." }, { status: 409 });
  }
  if (registration.payment_status === "paid") {
    return NextResponse.json({ error: "This entry is already paid." }, { status: 409 });
  }
  if (registration.status === "waitlisted") {
    return NextResponse.json(
      { error: "You're on the waitlist — we'll collect payment once you're moved into a slot." },
      { status: 409 }
    );
  }
  if (registration.status !== "awaiting_payment" && registration.status !== "pending") {
    return NextResponse.json({ error: "This entry can't be paid." }, { status: 409 });
  }

  const tournament = relationOne(registration.tournaments) as {
    name: string;
    slug: string;
    entry_fee_cents: number;
  };
  const division = relationOne(registration.tournament_divisions) as {
    entry_fee_cents: number | null;
  } | null;
  const fee = division?.entry_fee_cents ?? tournament.entry_fee_cents;

  const payment = await startRegistrationQrphPayment({
    registrationId: registration.id,
    userId: user.id,
    tournamentId: registration.tournament_id,
    tournamentName: tournament.name,
    tournamentSlug: tournament.slug,
    amountCents: fee,
    idempotencyKey: `reg-${registration.id}-${Date.now()}`,
  });

  return NextResponse.json({
    qrImageUrl: payment.qrImageUrl,
    paymentIntentId: payment.paymentIntentId,
    expiresAt: payment.expiresAt,
    checkoutUrl: payment.checkoutUrl,
  });
}