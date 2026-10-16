import { createAdminClient } from "@/lib/supabase/admin";

export type RegistrationMode = "open" | "bracket_only";

/** Reads the event's mode with `*` so it still works before the migration adds the column. */
export function modeOf(row: Record<string, unknown> | null | undefined): RegistrationMode {
  return row?.registration_mode === "bracket_only" ? "bracket_only" : "open";
}

export async function getRegistrationMode(tournamentId: string): Promise<RegistrationMode> {
  const { data } = await createAdminClient().from("tournaments").select("*").eq("id", tournamentId).maybeSingle();
  return modeOf(data as Record<string, unknown> | null);
}
