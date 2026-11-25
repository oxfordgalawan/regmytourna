"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth/require-user";
import { tournamentFormSchema, divisionSchema } from "@/lib/validations/tournament";
import { isSupabaseConfigured } from "@/lib/env/server";
import {
  categoriesPayloadSchema,
  categoryName,
  categoryType,
  divisionDetailsUpdateSchema,
} from "@/lib/categories";
import { defaultConfigFor } from "@/lib/bracket-format";
import { validateSchedule } from "@/lib/validations/schedule";
import { isOrganizerForTournament } from "@/lib/auth/require-organizer";
import { createOrganizerDataClient, getOrganizerActAsContext } from "@/lib/auth/organizer-act-as";
import { getRegistrationMode } from "@/lib/tournaments/mode";
import { registrationInstantForDb } from "@/lib/tournaments/registration-window";
import type { TournamentStatus } from "@/types/database";

const PUBLISH_STATUSES: TournamentStatus[] = ["published", "registration_open"];

export async function updateTournamentStatusAction(
  tournamentId: string,
  status: TournamentStatus
): Promise<{ ok?: true; error?: string }> {
  if (!isSupabaseConfigured()) return { error: "Supabase not configured" };
  const user = await requireUser();
  if (!(await isOrganizerForTournament(user.id, tournamentId, user))) {
    return { error: "You don't have permission to change this event." };
  }
  if (!PUBLISH_STATUSES.includes(status) && status !== "registration_closed") {
    return { error: "That status change isn't supported here." };
  }
  if ((await getRegistrationMode(tournamentId)) === "bracket_only" && status === "registration_open") {
    return { error: "Bracket-only events don't take online registration." };
  }

  const supabase = await createOrganizerDataClient(user);
  const { data: row, error } = await supabase
    .from("tournaments")
    .update({ status })
    .eq("id", tournamentId)
    .select("slug")
    .single();
  if (error) return { error: error.message };

  revalidatePath("/organizer/tournaments");
  revalidatePath(`/organizer/tournaments/${tournamentId}`);
  if (row?.slug) revalidatePath(`/tournaments/${row.slug}`);
  return { ok: true };
}

const UNPAID_REGISTRATION_STATUSES = [
  "pending",
  "awaiting_partner",
  "awaiting_payment",
  "waitlisted",
] as const;

async function tournamentHasFinancialHistory(tournamentId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data: regs } = await admin.from("registrations").select("id").eq("tournament_id", tournamentId);
  const regIds = (regs ?? []).map((r) => r.id);
  if (regIds.length > 0) {
    const { count, error } = await admin
      .from("payments")
      .select("id", { count: "exact", head: true })
      .in("registration_id", regIds);
    if (error) throw new Error(error.message);
    if ((count ?? 0) > 0) return true;
  }
  const { count: walletCount, error: walletError } = await admin
    .from("wallet_transactions")
    .select("id", { count: "exact", head: true })
    .eq("tournament_id", tournamentId);
  if (walletError) throw new Error(walletError.message);
  return (walletCount ?? 0) > 0;
}

function revalidateTournamentPaths(tournamentId: string, slug?: string | null) {
  revalidatePath("/organizer/tournaments");
  revalidatePath(`/organizer/tournaments/${tournamentId}`);
  revalidatePath(`/organizer/tournaments/${tournamentId}/edit`);
  if (slug) revalidatePath(`/tournaments/${slug}`);
}

export async function cancelTournamentAction(
  tournamentId: string
): Promise<{ ok?: true; error?: string }> {
  if (!isSupabaseConfigured()) return { error: "Supabase not configured" };
  const user = await requireUser();
  if (!(await isOrganizerForTournament(user.id, tournamentId, user))) {
    return { error: "You don't have permission to change this event." };
  }

  const admin = createAdminClient();
  const { data: tournament, error: loadError } = await admin
    .from("tournaments")
    .select("status, slug")
    .eq("id", tournamentId)
    .single();
  if (loadError || !tournament) return { error: loadError?.message ?? "Event not found." };
  if (tournament.status === "draft") {
    return { error: "Draft events can't be cancelled. Delete the draft instead." };
  }
  if (tournament.status === "cancelled") return { error: "This event is already cancelled." };

  const { error: updateError } = await admin
    .from("tournaments")
    .update({ status: "cancelled", is_public: false })
    .eq("id", tournamentId);
  if (updateError) return { error: updateError.message };

  const { data: unpaidRegs } = await admin
    .from("registrations")
    .select("id")
    .eq("tournament_id", tournamentId)
    .in("status", [...UNPAID_REGISTRATION_STATUSES]);
  for (const reg of unpaidRegs ?? []) {
    await admin.from("payments").update({ status: "cancelled" }).eq("registration_id", reg.id).eq("status", "pending");
    await admin
      .from("registrations")
      .update({ status: "cancelled", waitlist_position: null, needs_partner_since: null })
      .eq("id", reg.id);
  }

  revalidateTournamentPaths(tournamentId, tournament.slug);
  return { ok: true };
}

export async function deleteTournamentAction(
  tournamentId: string
): Promise<{ ok?: true; redirect?: string; error?: string }> {
  if (!isSupabaseConfigured()) return { error: "Supabase not configured" };
  const user = await requireUser();
  if (!(await isOrganizerForTournament(user.id, tournamentId, user))) {
    return { error: "You don't have permission to change this event." };
  }

  const admin = createAdminClient();
  const { data: tournament, error: loadError } = await admin
    .from("tournaments")
    .select("slug")
    .eq("id", tournamentId)
    .single();
  if (loadError || !tournament) return { error: loadError?.message ?? "Event not found." };

  try {
    if (await tournamentHasFinancialHistory(tournamentId)) {
      return {
        error:
          "This event has payment or wallet history and can't be deleted. Cancel it instead to hide it from public listings.",
      };
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't verify whether this event can be deleted." };
  }

  const { error: deleteError } = await admin.from("tournaments").delete().eq("id", tournamentId);
  if (deleteError) return { error: deleteError.message };

  revalidatePath("/organizer/tournaments");
  if (tournament.slug) revalidatePath(`/tournaments/${tournament.slug}`);
  return { ok: true, redirect: "/organizer/tournaments" };
}

/** Whether hard-delete is allowed (no payments or wallet transactions). */
export async function tournamentCanBeDeleted(tournamentId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    return !(await tournamentHasFinancialHistory(tournamentId));
  } catch {
    return false;
  }
}

export async function createTournamentAction(formData: FormData) {
  if (!isSupabaseConfigured()) return { error: "Supabase not configured" };
  const user = await requireUser();
  if (await getOrganizerActAsContext(user)) {
    return { error: "Exit view-as mode before creating a new tournament." };
  }

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
    waitlistMax: formData.get("waitlistMax") ?? "",
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
  // bracket-only: the organizer imports players — no registration window, fees, waitlist or payments
  const bracketOnly = formData.get("registrationMode") === "bracket_only";
  if (bracketOnly) {
    v.registrationOpensAt = undefined;
    v.registrationClosesAt = undefined;
    v.entryFeeCents = 0;
    v.waitlistEnabled = false;
    v.waitlistMax = undefined;
    if (!["draft", "published"].includes(v.status)) v.status = "published";
    for (const c of categories.data) c.entryFeeCents = 0;
  }
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
      waitlist_max: v.waitlistEnabled ? (v.waitlistMax ?? null) : null,
      allow_walk_in_payment: !bracketOnly && formData.get("allowWalkInPayment") === "on",
      // only sent when needed, so regular events still save before the migration is applied
      ...(bracketOnly ? { registration_mode: "bracket_only" } : {}),
    })
    .select("id, slug")
    .single();

  if (error) {
    return {
      error: error.message.includes("registration_mode")
        ? "Bracket-only events need the latest database migration — run it and try again."
        : error.message,
    };
  }

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

/**
 * Edit an existing event's details (name, dates, venue, rules, cover, toggles).
 * Status, categories and brackets have their own controls and aren't touched here.
 */
export async function updateTournamentAction(
  tournamentId: string,
  formData: FormData
): Promise<{ ok?: true; slug?: string; error?: string }> {
  if (!isSupabaseConfigured()) return { error: "Supabase not configured" };
  const user = await requireUser();
  if (!(await isOrganizerForTournament(user.id, tournamentId, user))) {
    return { error: "You don't have permission to change this event." };
  }

  const supabase = await createOrganizerDataClient(user);
  const { data: current } = await supabase
    .from("tournaments")
    .select("slug, status, cover_image_url")
    .eq("id", tournamentId)
    .single();
  if (!current) return { error: "Event not found." };

  const parsed = tournamentFormSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description") || undefined,
    sport: "pickleball",
    status: current.status,
    startDate: formData.get("startDate") || undefined,
    endDate: formData.get("endDate") || undefined,
    registrationOpensAt: formData.get("registrationOpensAt") || undefined,
    registrationClosesAt: formData.get("registrationClosesAt") || undefined,
    venueName: formData.get("venueName") || undefined,
    venueAddress: formData.get("venueAddress") || undefined,
    city: formData.get("city") || undefined,
    region: formData.get("region") || undefined,
    entryFeeCents: 0,
    rules: formData.get("rules") || undefined,
    coverImageUrl: formData.get("coverImageUrl") || "",
    isPublic: formData.get("isPublic") === "on",
    waitlistEnabled: formData.get("waitlistEnabled") === "on",
    waitlistMax: formData.get("waitlistMax") ?? "",
  });
  if (!parsed.success) {
    const first = Object.entries(parsed.error.flatten().fieldErrors)[0];
    return { error: first ? `${first[0]}: ${first[1]?.join(", ")}` : "Please check the form and try again." };
  }
  const v = parsed.data;

  const bracketOnly = (await getRegistrationMode(tournamentId)) === "bracket_only";
  if (bracketOnly) {
    v.registrationOpensAt = undefined;
    v.registrationClosesAt = undefined;
    v.waitlistEnabled = false;
    v.waitlistMax = undefined;
  }
  const scheduleError = Object.values(validateSchedule(v))[0];
  if (scheduleError) return { error: scheduleError };

  // a new cover must come from the uploader's own (optimized) folder; the current one may stay
  const coverPrefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/tournament-covers/${user.id}/`;
  if (v.coverImageUrl && v.coverImageUrl !== current.cover_image_url && !v.coverImageUrl.startsWith(coverPrefix)) {
    return { error: "Please upload the cover photo again." };
  }

  const { error } = await supabase
    .from("tournaments")
    .update({
      name: v.name,
      slug: v.slug,
      description: v.description ?? null,
      start_date: v.startDate || null,
      end_date: v.endDate || null,
      registration_opens_at: v.registrationOpensAt || null,
      registration_closes_at: v.registrationClosesAt || null,
      venue_name: v.venueName ?? null,
      venue_address: v.venueAddress ?? null,
      city: v.city ?? null,
      region: v.region ?? null,
      rules: v.rules ?? null,
      cover_image_url: v.coverImageUrl || null,
      is_public: v.isPublic,
      waitlist_enabled: v.waitlistEnabled,
      waitlist_max: v.waitlistEnabled ? (v.waitlistMax ?? null) : null,
      ...(bracketOnly ? {} : { allow_walk_in_payment: formData.get("allowWalkInPayment") === "on" }),
    })
    .eq("id", tournamentId);
  if (error) {
    if (error.code === "23505") return { error: "That page address is already taken. Try another." };
    return { error: error.message };
  }

  // clean up the replaced cover (best effort; only files in the uploader's folder)
  const old = current.cover_image_url;
  if (old && old !== v.coverImageUrl && old.startsWith(coverPrefix)) {
    await supabase.storage.from("tournament-covers").remove([old.slice(coverPrefix.length - user.id.length - 1)]);
  }

  revalidatePath("/organizer/tournaments");
  revalidatePath(`/organizer/tournaments/${tournamentId}`, "layout");
  revalidatePath(`/tournaments/${current.slug}`);
  if (v.slug !== current.slug) revalidatePath(`/tournaments/${v.slug}`);
  revalidatePath("/tournaments");
  revalidatePath("/");
  return { ok: true, slug: v.slug };
}

function tournamentCoverPrefix(userId: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/tournament-covers/${userId}/`;
}

function storagePathFromCoverUrl(userId: string, url: string): string | null {
  const prefix = tournamentCoverPrefix(userId);
  if (!url.startsWith(prefix)) return null;
  return url.slice(prefix.length);
}

/** Updates only the event cover image (overview uploader). */
export async function updateTournamentCoverAction(
  tournamentId: string,
  coverImageUrl: string | null
): Promise<{ ok?: true; error?: string }> {
  if (!isSupabaseConfigured()) return { error: "Supabase not configured" };
  const user = await requireUser();
  if (!(await isOrganizerForTournament(user.id, tournamentId, user))) {
    return { error: "You don't have permission to change this event." };
  }

  const supabase = await createOrganizerDataClient(user);
  const { data: current } = await supabase
    .from("tournaments")
    .select("slug, cover_image_url")
    .eq("id", tournamentId)
    .single();
  if (!current) return { error: "Event not found." };

  const next = coverImageUrl?.trim() || null;
  const coverPrefix = tournamentCoverPrefix(user.id);
  if (next && next !== current.cover_image_url && !next.startsWith(coverPrefix)) {
    return { error: "Please upload the cover photo again." };
  }

  const { error } = await supabase.from("tournaments").update({ cover_image_url: next }).eq("id", tournamentId);
  if (error) return { error: error.message };

  const old = current.cover_image_url;
  if (old && old !== next) {
    const path = storagePathFromCoverUrl(user.id, old);
    if (path) await supabase.storage.from("tournament-covers").remove([path]);
  }

  revalidatePath("/organizer/tournaments");
  revalidatePath(`/organizer/tournaments/${tournamentId}`, "layout");
  revalidatePath(`/organizer/tournaments/${tournamentId}`);
  revalidatePath(`/tournaments/${current.slug}`);
  revalidatePath("/tournaments");
  revalidatePath("/");
  return { ok: true };
}

export async function addDivisionAction(tournamentId: string, formData: FormData) {
  const user = await requireUser();
  if (!(await isOrganizerForTournament(user.id, tournamentId, user))) {
    return { error: "You don't have permission to change this event." };
  }
  const parsed = divisionSchema.safeParse({
    name: formData.get("name"),
    format: formData.get("format"),
    capacity: formData.get("capacity") || undefined,
    entryFeeCents: formData.get("entryFeeCents") || undefined,
    eligibilityNotes: formData.get("eligibilityNotes") || undefined,
  });
  if (!parsed.success) return { error: "Invalid division" };

  const supabase = await createOrganizerDataClient(user);
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

async function revalidateDivisionPaths(tournamentId: string, slug: string | null) {
  revalidatePath(`/organizer/tournaments/${tournamentId}/divisions`);
  revalidatePath(`/organizer/tournaments/${tournamentId}/draw`);
  if (slug) {
    revalidatePath(`/tournaments/${slug}`);
  }
}

export async function updateDivisionDetailsAction(
  divisionId: string,
  formData: FormData
): Promise<{ ok?: true; error?: string }> {
  const user = await requireUser();
  const admin = createAdminClient();
  const { data: division } = await admin
    .from("tournament_divisions")
    .select("id, tournament_id, name, format, bracket_state")
    .eq("id", divisionId)
    .maybeSingle();
  if (!division) return { error: "Category not found" };
  if (!(await isOrganizerForTournament(user.id, division.tournament_id, user))) {
    return { error: "You don't have permission to change this event." };
  }

  const bracketStarted = (division.bracket_state ?? "not_started") !== "not_started";
  if (bracketStarted) {
    return { error: "This category can't be edited after the bracket has started." };
  }

  const rawFee = formData.get("entryFeeCents");
  const feeParsed =
    rawFee === null || String(rawFee).trim() === ""
      ? undefined
      : Math.round(Number(rawFee));

  const parsed = divisionDetailsUpdateSchema.safeParse({
    type: formData.get("type"),
    title: formData.get("title") ?? "",
    capacity: formData.get("capacity"),
    entryFeeCents: feeParsed,
  });
  if (!parsed.success) return { error: "Invalid category details." };

  const name = categoryName(parsed.data.type, parsed.data.title);
  const format = categoryType(parsed.data.type).format;

  if (format !== division.format) {
    const { count } = await admin
      .from("registrations")
      .select("id", { count: "exact", head: true })
      .eq("division_id", divisionId)
      .eq("status", "confirmed");
    if ((count ?? 0) > 0) {
      return {
        error: "Can't switch between singles and doubles while players are registered in this category.",
      };
    }
  }

  if (name !== division.name) {
    const { data: clash } = await admin
      .from("tournament_divisions")
      .select("id")
      .eq("tournament_id", division.tournament_id)
      .eq("name", name)
      .neq("id", divisionId)
      .maybeSingle();
    if (clash) return { error: `"${name}" already exists in this event.` };
  }

  const supabase = await createOrganizerDataClient(user);
  const { error } = await supabase
    .from("tournament_divisions")
    .update({
      name,
      format,
      capacity: parsed.data.capacity,
      entry_fee_cents: parsed.data.entryFeeCents ?? null,
    })
    .eq("id", divisionId);
  if (error) {
    return {
      error: error.message.includes("duplicate") ? `"${name}" already exists in this event.` : error.message,
    };
  }

  const { data: t } = await admin.from("tournaments").select("slug").eq("id", division.tournament_id).maybeSingle();
  await revalidateDivisionPaths(division.tournament_id, t?.slug ?? null);
  return { ok: true };
}
