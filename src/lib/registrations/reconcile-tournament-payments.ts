import { createAdminClient } from "@/lib/supabase/admin";
import { isPayMongoConfigured } from "@/lib/env/server";
import {
  settlePaidCheckout,
  settlePaidIntent,
} from "@/lib/payments/settle";
import { isCheckoutSessionPaid } from "@/lib/services/paymongo/paymongo-service";
import { isPaymentIntentPaid } from "@/lib/services/paymongo/paymongo-qrph";
import { relationOne } from "@/lib/supabase/relations";
import { computeRegistrationBalance, getFeeDueCents } from "@/lib/registrations/payment-balance";
import {
  buildDivisionTeamPaidCents,
  divisionTeamKey,
  entryTeamKey,
  type PaymentSlice,
} from "@/lib/registrations/entry-team-key";
const RECONCILE_PLAYERS_SELECT =
  "registration_players(user_id, guest_email, guest_name, is_primary)";

/**
 * Aligns registration status with PayMongo and with paid rows in `payments`
 * (wallet can be correct while Entries still shows awaiting_payment after a missed webhook).
 */
export async function reconcileTournamentRegistrationPayments(tournamentId: string) {
  const admin = createAdminClient();

  const { data: regs } = await admin
    .from("registrations")
    .select(
      `id, status, payment_status, division_id, tournaments(entry_fee_cents), tournament_divisions(entry_fee_cents), payments(status, amount_cents, paymongo_checkout_session_id, paymongo_payment_intent_id, created_at), ${RECONCILE_PLAYERS_SELECT}`
    )
    .eq("tournament_id", tournamentId);

  if (!regs?.length) return;

  if (isPayMongoConfigured()) {
    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const pending = (regs ?? [])
      .flatMap((r) =>
        ((r.payments ?? []) as Array<{
          status: string;
          paymongo_checkout_session_id: string | null;
          paymongo_payment_intent_id: string | null;
          created_at: string;
        }>)
          .filter((p) => p.status === "pending" && p.created_at >= since)
          .map((p) => ({ registrationId: r.id, ...p }))
      )
      .slice(0, 12);

    for (const p of pending) {
      if (p.paymongo_payment_intent_id && (await isPaymentIntentPaid(p.paymongo_payment_intent_id))) {
        await settlePaidIntent(p.registrationId, p.paymongo_payment_intent_id);
      } else if (p.paymongo_checkout_session_id && (await isCheckoutSessionPaid(p.paymongo_checkout_session_id))) {
        await settlePaidCheckout(p.registrationId, p.paymongo_checkout_session_id);
      }
    }
  }

  const { data: fresh } = await admin
    .from("registrations")
    .select(
      `id, status, payment_status, division_id, tournaments(entry_fee_cents), tournament_divisions(entry_fee_cents), ${RECONCILE_PLAYERS_SELECT}`
    )
    .eq("tournament_id", tournamentId);

  const regIds = (fresh ?? []).map((r) => r.id as string);
  const paymentsByRegistrationId = new Map<string, PaymentSlice[]>();
  if (regIds.length) {
    const { data: paymentRows } = await admin
      .from("payments")
      .select("registration_id, method, status, amount_cents, recorded_by")
      .in("registration_id", regIds);
    for (const p of paymentRows ?? []) {
      const id = p.registration_id as string;
      const list = paymentsByRegistrationId.get(id) ?? [];
      list.push({
        method: p.method as string,
        status: p.status as string,
        amount_cents: p.amount_cents as number,
        recorded_by: p.recorded_by as string | null,
      });
      paymentsByRegistrationId.set(id, list);
    }
  }

  type PlayerRow = { user_id: string | null; guest_email: string | null };
  const userIds = [
    ...new Set(
      (fresh ?? []).flatMap((r) =>
        ((r.registration_players ?? []) as PlayerRow[]).map((p) => p.user_id).filter(Boolean) as string[]
      )
    ),
  ];
  const accountEmails = new Map<string, string>();
  await Promise.all(
    userIds.map(async (id) => {
      const { data: u } = await admin.auth.admin.getUserById(id);
      if (u?.user?.email) accountEmails.set(id, u.user.email);
    })
  );

  const teamPaymentIndex = buildDivisionTeamPaidCents(
    (fresh ?? []).map((r) => ({
      id: r.id as string,
      division_id: r.division_id as string,
      players: (r.registration_players ?? []) as PlayerRow[],
    })),
    accountEmails,
    paymentsByRegistrationId
  );

  for (const r of fresh ?? []) {
    if (r.status === "cancelled") continue;
    const tournament = relationOne(r.tournaments as never) as { entry_fee_cents: number } | null;
    const division = relationOne(r.tournament_divisions as never) as { entry_fee_cents: number | null } | null;
    const feeDueCents = getFeeDueCents({
      divisionEntryFeeCents: division?.entry_fee_cents,
      tournamentEntryFeeCents: tournament?.entry_fee_cents,
    });
    const teamTk = divisionTeamKey(
      r.division_id as string,
      entryTeamKey((r.registration_players ?? []) as PlayerRow[], accountEmails)
    );
    const paidCents = teamPaymentIndex.paidCentsByDivisionTeam.get(teamTk) ?? 0;
    if (paidCents <= 0) continue;

    const balance = computeRegistrationBalance(feeDueCents, paidCents);
    const payment_status = balance.fullyPaid ? "paid" : "partial";
    const status =
      balance.fullyPaid && (r.status === "awaiting_payment" || r.status === "pending")
        ? "confirmed"
        : r.status === "awaiting_payment" || r.status === "pending"
          ? "confirmed"
          : r.status;

    if (payment_status !== r.payment_status || status !== r.status) {
      await admin.from("registrations").update({ payment_status, status }).eq("id", r.id);
    }
  }
}