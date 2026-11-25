"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireOrganizerForTournament } from "@/lib/auth/require-organizer";
import { relationOne } from "@/lib/supabase/relations";
import { REGISTRATION_PLAYERS_SELECT, registrationName } from "@/lib/registrations/name";
import {
  computeRegistrationBalance,
  getFeeDueCents,
  sumPaidCents,
} from "@/lib/registrations/payment-balance";
import { notifyRegistrantBalanceDue } from "@/lib/registrations/balance-due-notify";
import { revalidatePath } from "next/cache";

export type FeeCorrectionPreviewRow = {
  registrationId: string;
  teamName: string;
  divisionName: string;
  captainEmail: string | null;
  feeDueCents: number;
  paidCents: number;
  balanceDueCents: number;
  paymentStatus: string;
};

export async function previewFeeCorrection(
  tournamentId: string
): Promise<{ error: string } | { rows: FeeCorrectionPreviewRow[] }> {
  try {
    await requireOrganizerForTournament(tournamentId);
  } catch {
    return { error: "Not allowed" };
  }

  const admin = createAdminClient();
  const { data: tournament } = await admin
    .from("tournaments")
    .select("entry_fee_cents, slug")
    .eq("id", tournamentId)
    .maybeSingle();
  if (!tournament) return { error: "Tournament not found" };

  const { data: regs } = await admin
    .from("registrations")
    .select(
      `id, payment_status, status, registered_by, ${REGISTRATION_PLAYERS_SELECT},
      tournament_divisions(name, entry_fee_cents), tournaments(entry_fee_cents)`
    )
    .eq("tournament_id", tournamentId)
    .in("payment_status", ["paid", "partial"])
    .neq("status", "cancelled")
    .neq("status", "waitlisted");

  const rows: FeeCorrectionPreviewRow[] = [];
  for (const reg of regs ?? []) {
    const division = relationOne(reg.tournament_divisions) as {
      name: string;
      entry_fee_cents: number | null;
    } | null;
    const t = relationOne(reg.tournaments) as { entry_fee_cents: number } | null;
    const feeDueCents = getFeeDueCents({
      divisionEntryFeeCents: division?.entry_fee_cents,
      tournamentEntryFeeCents: t?.entry_fee_cents ?? tournament.entry_fee_cents,
    });
    const paidCents = await sumPaidCents(admin as never, reg.id);
    const balance = computeRegistrationBalance(feeDueCents, paidCents);
    if (paidCents <= 0 || balance.balanceDueCents <= 0) continue;

    const { data: authUser } = await admin.auth.admin.getUserById(reg.registered_by);
    rows.push({
      registrationId: reg.id,
      teamName: registrationName(reg),
      divisionName: division?.name ?? "Category",
      captainEmail: authUser?.user?.email ?? null,
      feeDueCents,
      paidCents,
      balanceDueCents: balance.balanceDueCents,
      paymentStatus: reg.payment_status,
    });
  }

  return { rows };
}

export async function applyFeeCorrection(input: {
  tournamentId: string;
  registrationIds: string[];
  organizerNote?: string;
}): Promise<{ error: string } | { emailed: number; markedPartial: number }> {
  try {
    await requireOrganizerForTournament(input.tournamentId);
  } catch {
    return { error: "Not allowed" };
  }

  if (!input.registrationIds.length) return { error: "Select at least one entry" };

  const admin = createAdminClient();
  const { data: tournament } = await admin.from("tournaments").select("slug").eq("id", input.tournamentId).single();

  let emailed = 0;
  let markedPartial = 0;

  for (const registrationId of input.registrationIds) {
    const { data: reg } = await admin
      .from("registrations")
      .select("id, tournament_id, payment_status, status")
      .eq("id", registrationId)
      .eq("tournament_id", input.tournamentId)
      .maybeSingle();
    if (!reg || reg.status === "cancelled" || reg.status === "waitlisted") continue;

    await admin.from("registrations").update({ payment_status: "partial" }).eq("id", registrationId);
    markedPartial += 1;

    const result = await notifyRegistrantBalanceDue(registrationId, {
      organizerNote: input.organizerNote,
    });
    if (result && "ok" in result) emailed += 1;
  }

  if (tournament?.slug) {
    revalidatePath(`/organizer/tournaments/${input.tournamentId}/registrations`);
    revalidatePath(`/tournaments/${tournament.slug}`);
  }

  return { emailed, markedPartial };
}