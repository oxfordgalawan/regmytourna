"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";
import { tournamentFormSchema, divisionSchema } from "@/lib/validations/tournament";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env/server";

export async function createTournamentAction(formData: FormData) {
  if (!isSupabaseConfigured()) return { error: "Supabase not configured" };
  const user = await requireUser();

  const parsed = tournamentFormSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description") || undefined,
    sport: formData.get("sport") || "pickleball",
    status: formData.get("status") || "draft",
    startDate: formData.get("startDate") || undefined,
    endDate: formData.get("endDate") || undefined,
    registrationOpensAt: formData.get("registrationOpensAt") || undefined,
    registrationClosesAt: formData.get("registrationClosesAt") || undefined,
    venueName: formData.get("venueName") || undefined,
    venueAddress: formData.get("venueAddress") || undefined,
    city: formData.get("city") || undefined,
    region: formData.get("region") || undefined,
    maxCapacity: formData.get("maxCapacity") || undefined,
    entryFeeCents: formData.get("entryFeeCents") ?? 0,
    currency: formData.get("currency") || "PHP",
    rules: formData.get("rules") || undefined,
    coverImageUrl: formData.get("coverImageUrl") || "",
    isPublic: formData.get("isPublic") === "on",
    waitlistEnabled: formData.get("waitlistEnabled") === "on",
  });

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const v = parsed.data;
  const supabase = await createClient();
  const { data: tournament, error } = await supabase
    .from("tournaments")
    .insert({
      owner_id: user.id,
      name: v.name,
      slug: v.slug,
      description: v.description,
      sport: v.sport,
      status: v.status,
      start_date: v.startDate || null,
      end_date: v.endDate || null,
      registration_opens_at: v.registrationOpensAt || null,
      registration_closes_at: v.registrationClosesAt || null,
      venue_name: v.venueName,
      venue_address: v.venueAddress,
      city: v.city,
      region: v.region,
      max_capacity: v.maxCapacity ?? null,
      entry_fee_cents: v.entryFeeCents,
      currency: v.currency,
      rules: v.rules,
      cover_image_url: v.coverImageUrl || null,
      is_public: v.isPublic,
      waitlist_enabled: v.waitlistEnabled,
    })
    .select("id, slug")
    .single();

  if (error) return { error: error.message };

  await supabase.from("tournament_organizers").insert({
    tournament_id: tournament.id,
    user_id: user.id,
    role: "owner",
  });

  const defaultDivisions = [
    { name: "Men's Singles", format: "singles" as const },
    { name: "Women's Singles", format: "singles" as const },
    { name: "Men's Doubles", format: "doubles" as const },
    { name: "Women's Doubles", format: "doubles" as const },
    { name: "Mixed Doubles", format: "doubles" as const },
    { name: "Open Division", format: "singles" as const },
  ];
  await supabase.from("tournament_divisions").insert(
    defaultDivisions.map((d, i) => ({
      tournament_id: tournament.id,
      name: d.name,
      format: d.format,
      sort_order: i,
      entry_fee_cents: v.entryFeeCents,
    }))
  );

  revalidatePath("/organizer/tournaments");
  return { success: true, id: tournament.id, slug: tournament.slug };
}

export async function addDivisionAction(tournamentId: string, formData: FormData) {
  await requireUser();
  const parsed = divisionSchema.safeParse({
    name: formData.get("name"),
    format: formData.get("format"),
    capacity: formData.get("capacity") || undefined,
    entryFeeCents: formData.get("entryFeeCents") || undefined,
    eligibilityNotes: formData.get("eligibilityNotes") || undefined,
  });
  if (!parsed.success) return { error: "Invalid division" };

  const supabase = await createClient();
  const { error } = await supabase.from("tournament_divisions").insert({
    tournament_id: tournamentId,
    name: parsed.data.name,
    format: parsed.data.format,
    capacity: parsed.data.capacity ?? null,
    entry_fee_cents: parsed.data.entryFeeCents ?? null,
    eligibility_notes: parsed.data.eligibilityNotes ?? null,
  });
  if (error) return { error: error.message };
  revalidatePath(`/organizer/tournaments/${tournamentId}/divisions`);
  return { success: true };
}

export async function linkChallongeTournamentAction(
  tournamentId: string,
  challongeTournamentId: string,
  challongeUrl: string
) {
  await requireUser();
  const admin = createAdminClient();
  const { error } = await admin
    .from("tournaments")
    .update({
      challonge_tournament_id: challongeTournamentId,
      challonge_url: challongeUrl,
    })
    .eq("id", tournamentId);
  if (error) return { error: error.message };
  revalidatePath(`/organizer/tournaments/${tournamentId}`);
  return { success: true };
}

export async function syncChallongeAction(tournamentId: string) {
  const user = await requireUser();
  const admin = createAdminClient();
  const { data: tournament } = await admin
    .from("tournaments")
    .select("challonge_tournament_id")
    .eq("id", tournamentId)
    .single();
  if (!tournament?.challonge_tournament_id) {
    return { error: "Link a Challonge tournament first" };
  }

  const { ChallongeService } = await import("@/lib/services/challonge/challonge-service");
  const service = await ChallongeService.forUser(user.id);
  if (!service) return { error: "Connect Challonge in Settings" };

  try {
    await service.syncParticipants(tournamentId, tournament.challonge_tournament_id);
    await service.syncMatches(tournamentId, tournament.challonge_tournament_id);
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Sync failed" };
  }
}
