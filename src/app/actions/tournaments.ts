"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth/require-user";
import { tournamentFormSchema, divisionSchema } from "@/lib/validations/tournament";
import { isSupabaseConfigured } from "@/lib/env/server";
import { categoriesPayloadSchema, categoryName, categoryType } from "@/lib/categories";
import { defaultConfigFor } from "@/lib/bracket-format";
import { validateSchedule } from "@/lib/validations/schedule";

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

  // validate categories before anything is written
  let rawCategories: unknown = [];
  try {
    rawCategories = JSON.parse(String(formData.get("categories") ?? "[]"));
  } catch {
    return { error: "Categories could not be read. Please try again." };
  }
  const categories = categoriesPayloadSchema.safeParse(rawCategories);
  if (!categories.success) {
    return { error: categories.error.issues[0]?.message ?? "Please check your categories." };
  }

  const v = parsed.data;
  const scheduleError = Object.values(validateSchedule(v))[0];
  if (scheduleError) return { error: scheduleError };

  // covers must come from our own (optimized) bucket, not arbitrary sites
  const coverPrefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/tournament-covers/${user.id}/`;
  if (v.coverImageUrl && !v.coverImageUrl.startsWith(coverPrefix)) {
    return { error: "Please upload the cover photo again." };
  }
  const admin = createAdminClient();
  const { data: tournament, error } = await admin
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
      allow_walk_in_payment: formData.get("allowWalkInPayment") === "on",
    })
    .select("id, slug")
    .single();

  if (error) return { error: error.message };

  await admin.from("tournament_organizers").insert({
    tournament_id: tournament.id,
    user_id: user.id,
    role: "owner",
  });

  const { error: divisionsError } = await admin.from("tournament_divisions").insert(
    categories.data.map((c, i) => ({
      tournament_id: tournament.id,
      name: categoryName(c.type, c.title),
      format: categoryType(c.type).format,
      capacity: c.capacity ?? null,
      entry_fee_cents: c.entryFeeCents ?? v.entryFeeCents,
      bracket_config: c.bracketConfig ?? defaultConfigFor(c.capacity ?? 16),
      sort_order: i,
    }))
  );
  if (divisionsError) {
    // don't leave a tournament behind with no categories
    await admin.from("tournaments").delete().eq("id", tournament.id);
    return { error: `Couldn't save categories: ${divisionsError.message}` };
  }

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
