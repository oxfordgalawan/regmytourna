import { createAdminClient } from "@/lib/supabase/admin";
import { categoryType, parseCategoryFromDivisionName } from "@/lib/categories";
import {
  assertDoublesCrossCategoryAllowed,
  BASE_DOUBLES_TYPES,
  MIXED_DOUBLES_TYPE,
  type ActiveDoublesEntry,
} from "@/lib/registrations/cross-category-rules";

export { assertDoublesCrossCategoryAllowed, BASE_DOUBLES_TYPES, MIXED_DOUBLES_TYPE };
export type { ActiveDoublesEntry };

/** Active slot-holding statuses (waitlist excluded so MD waitlist does not block Mixed). */
export const CROSS_CATEGORY_ACTIVE = [
  "confirmed",
  "awaiting_payment",
  "pending",
  "awaiting_partner",
] as const;

export async function getUserActiveDoublesEntries(
  admin: ReturnType<typeof createAdminClient>,
  opts: { userId: string; tournamentId: string; excludeDivisionId?: string }
): Promise<ActiveDoublesEntry[]> {
  const { data: regs } = await admin
    .from("registrations")
    .select("id, division_id, registered_by, tournament_divisions(name, format)")
    .eq("tournament_id", opts.tournamentId)
    .in("status", [...CROSS_CATEGORY_ACTIVE]);

  if (!regs?.length) return [];

  const regIdsForUser = new Set<string>();
  for (const r of regs) {
    if (r.registered_by === opts.userId) regIdsForUser.add(r.id);
  }

  const candidateIds = regs.map((r) => r.id);
  if (candidateIds.length) {
    const { data: playerRows } = await admin
      .from("registration_players")
      .select("registration_id")
      .in("registration_id", candidateIds)
      .eq("user_id", opts.userId);
    for (const row of playerRows ?? []) {
      regIdsForUser.add(row.registration_id);
    }
  }

  const out: ActiveDoublesEntry[] = [];
  for (const r of regs) {
    if (!regIdsForUser.has(r.id)) continue;
    if (opts.excludeDivisionId && r.division_id === opts.excludeDivisionId) continue;
    const div = Array.isArray(r.tournament_divisions)
      ? r.tournament_divisions[0]
      : r.tournament_divisions;
    const division = div as { name: string; format: string } | null | undefined;
    if (!division || division.format !== "doubles") continue;
    const parsedType = parseCategoryFromDivisionName(division.name).type;
    if (
      !BASE_DOUBLES_TYPES.has(parsedType) &&
      parsedType !== MIXED_DOUBLES_TYPE
    ) {
      continue;
    }
    out.push({
      registrationId: r.id,
      divisionId: r.division_id,
      divisionName: division.name,
      categoryType: parsedType,
    });
  }

  return out;
}

export async function checkCrossCategoryEligibility(
  userId: string,
  tournamentId: string,
  targetDivisionId: string
): Promise<{ ok: true; existing: ActiveDoublesEntry[] } | { ok: false; error: string; existing: ActiveDoublesEntry[] }> {
  const admin = createAdminClient();
  const { data: division } = await admin
    .from("tournament_divisions")
    .select("id, name, format")
    .eq("id", targetDivisionId)
    .eq("tournament_id", tournamentId)
    .maybeSingle();
  if (!division) return { ok: false, error: "Division not found.", existing: [] };
  if (division.format !== "doubles") return { ok: true, existing: [] };

  const targetType = parseCategoryFromDivisionName(division.name).type;
  const existing = await getUserActiveDoublesEntries(admin, {
    userId,
    tournamentId,
    excludeDivisionId: targetDivisionId,
  });
  const verdict = assertDoublesCrossCategoryAllowed({
    existingEntries: existing,
    targetType,
    targetDivisionId,
  });
  if (!verdict.ok) return { ok: false, error: verdict.error, existing };
  return { ok: true, existing };
}

export function friendlyCrossCategorySummary(existing: ActiveDoublesEntry[]): string {
  if (!existing.length) return "";
  return existing.map((e) => categoryType(e.categoryType).label).join(", ");
}