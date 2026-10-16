"use server";

import { revalidatePath } from "next/cache";
import { requireOrganizerForTournament } from "@/lib/auth/require-organizer";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlayableMatch } from "@/lib/umpire/playable";

/**
 * The event-wide match queue. Every category shares it: a match joins a
 * court's line, the first one in line is "next", and umpires claim from it.
 */

type Result = { ok?: true; error?: string };

function refresh(tournamentId: string) {
  revalidatePath(`/organizer/tournaments/${tournamentId}/queue`);
  revalidatePath(`/organizer/tournaments/${tournamentId}/matches`);
  revalidatePath(`/organizer/tournaments/${tournamentId}/scoring`);
  revalidatePath(`/umpire/${tournamentId}`);
  revalidatePath(`/display/${tournamentId}`);
}

function migrationError(message: string) {
  return message.includes("court_queue_position")
    ? "The match queue needs the latest database migration — run it and try again."
    : message;
}

/** Re-numbers a court's line 1, 2, 3… keeping the current order. */
async function renumber(courtId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("matches")
    .select("id, court_queue_position, created_at")
    .eq("court_id", courtId)
    .eq("status", "scheduled")
    .order("court_queue_position", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
  await Promise.all(
    (data ?? []).map((m, i) =>
      m.court_queue_position === i + 1
        ? null
        : admin.from("matches").update({ court_queue_position: i + 1 }).eq("id", m.id)
    )
  );
}

async function loadMatch(tournamentId: string, matchId: string) {
  const { data } = await createAdminClient()
    .from("matches")
    .select("*")
    .eq("id", matchId)
    .eq("tournament_id", tournamentId)
    .maybeSingle();
  return data;
}

/** Puts a match at the end of a court's line (or moves it there from another court). */
export async function queueMatchAction(tournamentId: string, matchId: string, courtId: string): Promise<Result> {
  await requireOrganizerForTournament(tournamentId);
  const admin = createAdminClient();
  const match = await loadMatch(tournamentId, matchId);
  if (!match) return { error: "Match not found." };
  if (match.status !== "scheduled") return { error: "Only matches that haven't started can be queued." };
  if (!isPlayableMatch(match)) return { error: "Both teams need to be known before this match can be queued." };

  const { data: court } = await admin
    .from("courts")
    .select("id, active")
    .eq("id", courtId)
    .eq("tournament_id", tournamentId)
    .maybeSingle();
  if (!court) return { error: "Court not found." };
  if (court.active === false) return { error: "That court is turned off on the Courts tab." };
  if (match.court_id === courtId) return { ok: true };

  const { data: last } = await admin
    .from("matches")
    .select("court_queue_position")
    .eq("court_id", courtId)
    .eq("status", "scheduled")
    .order("court_queue_position", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  const { error } = await admin
    .from("matches")
    .update({ court_id: courtId, court_queue_position: (last?.court_queue_position ?? 0) + 1 })
    .eq("id", matchId);
  if (error) return { error: migrationError(error.message) };

  if (match.court_id) await renumber(match.court_id);
  refresh(tournamentId);
  return { ok: true };
}

/** Takes a match out of the queue (back to "ready to play"). */
export async function unqueueMatchAction(tournamentId: string, matchId: string): Promise<Result> {
  await requireOrganizerForTournament(tournamentId);
  const match = await loadMatch(tournamentId, matchId);
  if (!match) return { error: "Match not found." };
  if (match.status !== "scheduled") return { error: "This match has already started." };
  const { error } = await createAdminClient()
    .from("matches")
    .update({ court_id: null, court_queue_position: null })
    .eq("id", matchId);
  if (error) return { error: migrationError(error.message) };
  if (match.court_id) await renumber(match.court_id);
  refresh(tournamentId);
  return { ok: true };
}

/** Moves a queued match one place up or down in its court's line. */
export async function moveInQueueAction(tournamentId: string, matchId: string, direction: "up" | "down"): Promise<Result> {
  await requireOrganizerForTournament(tournamentId);
  const admin = createAdminClient();
  const match = await loadMatch(tournamentId, matchId);
  if (!match?.court_id) return { error: "This match isn't queued." };
  await renumber(match.court_id);
  const { data: line } = await admin
    .from("matches")
    .select("id, court_queue_position")
    .eq("court_id", match.court_id)
    .eq("status", "scheduled")
    .order("court_queue_position", { ascending: true });
  const list = line ?? [];
  const i = list.findIndex((m) => m.id === matchId);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= list.length) return { ok: true };
  await Promise.all([
    admin.from("matches").update({ court_queue_position: list[j].court_queue_position }).eq("id", list[i].id),
    admin.from("matches").update({ court_queue_position: list[i].court_queue_position }).eq("id", list[j].id),
  ]);
  refresh(tournamentId);
  return { ok: true };
}
