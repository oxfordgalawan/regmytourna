"use server";

import { requireOrganizerForTournament } from "@/lib/auth/require-organizer";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  currentSwissRound,
  flattenSeedsFromLayout,
  generateFirstStage,
  knockoutFromPools,
  nextSwissRound,
  poolStandings,
  resolvePending,
  revertResult,
  stageDone,
  validateSeedingLayout,
  type GameScore,
} from "@/lib/bracket-engine";
import { seedingLayoutSchema, toChallongeTournament } from "@/lib/bracket-format";
import { insertMatches, loadDivisionContext, nextMatchNumber, setDivisionState, writePatches } from "@/lib/draw/server";
import { advanceAfterResult, refreshDivisionState, revalidateDraw } from "@/lib/draw/progress";

type Result = { ok?: boolean; error?: string };

async function contextFor(divisionId: string) {
  const ctx = await loadDivisionContext(divisionId);
  if (!ctx) throw new Error("Category not found");
  await requireOrganizerForTournament(ctx.division.tournament_id);
  return ctx;
}

const fail = (e: unknown): Result => ({ error: e instanceof Error ? e.message : "Something went wrong" });

async function persistSeedOrder(divisionId: string, registrationIds: string[]) {
  const admin = createAdminClient();
  await Promise.all(
    registrationIds.map((id, i) => admin.from("registrations").update({ seed: i + 1 }).eq("id", id))
  );
}

/** Saves manual pool / bracket layout in bracket_config. Only before the bracket starts. */
export async function saveSeedingLayoutAction(
  divisionId: string,
  layout: unknown,
  listOrder: string[]
): Promise<Result> {
  try {
    const ctx = await contextFor(divisionId);
    if (ctx.division.bracket_state !== "not_started") return { error: "Seeds are locked once the bracket starts." };
    const parsed = seedingLayoutSchema.safeParse(layout);
    if (!parsed.success) return { error: "That seeding layout isn't valid." };
    const valid = new Set(ctx.entries.map((e) => e.id));
    if (listOrder.some((id) => !valid.has(id))) return { error: "That list doesn't match this category." };

    const config = { ...ctx.config, seedingLayout: parsed.data };
    const entryIds = ctx.entries.map((e) => e.id);
    const ordered = flattenSeedsFromLayout(config, entryIds, listOrder);

    const admin = createAdminClient();
    const { error } = await admin
      .from("tournament_divisions")
      .update({ bracket_config: config })
      .eq("id", divisionId);
    if (error) return { error: error.message };

    await persistSeedOrder(divisionId, [...ordered, ...ctx.allEntries.filter((e) => e.withdrawn).map((e) => e.id)]);
    await revalidateDraw(ctx.division.tournament_id, divisionId);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Saves the seed order (top seed first). Only before the bracket starts. */
export async function saveSeedsAction(divisionId: string, registrationIds: string[]): Promise<Result> {
  try {
    const ctx = await contextFor(divisionId);
    if (ctx.division.bracket_state !== "not_started") return { error: "Seeds are locked once the bracket starts." };
    const valid = new Set(ctx.allEntries.map((e) => e.id));
    if (registrationIds.some((id) => !valid.has(id))) return { error: "That list doesn't match this category." };
    await persistSeedOrder(divisionId, registrationIds);
    await revalidateDraw(ctx.division.tournament_id, divisionId);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function startBracketAction(divisionId: string): Promise<Result> {
  try {
    const ctx = await contextFor(divisionId);
    if (ctx.division.bracket_state !== "not_started") return { error: "This bracket has already started." };
    if (ctx.matches.some((m) => m.stage)) return { error: "Reset the existing draw first." };
    if (ctx.entries.length < 2) return { error: "You need at least 2 confirmed entries to start." };

    const entryIds = ctx.entries.map((e) => e.id);
    const listOrder = entryIds;
    const check = validateSeedingLayout(ctx.config, entryIds);
    if (!check.ok) return { error: check.errors[0] };

    const stage = generateFirstStage(ctx.config, ctx.entries);
    await insertMatches(stage.matches, ctx.division.tournament_id, divisionId);
    const ordered = flattenSeedsFromLayout(ctx.config, entryIds, listOrder);
    await persistSeedOrder(divisionId, ordered);
    await setDivisionState(divisionId, stage.state, { bracket_started_at: new Date().toISOString() });
    await revalidateDraw(ctx.division.tournament_id, divisionId);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Ends the pool stage and builds the knockout from the standings. */
export async function closePoolsAction(divisionId: string, force = false): Promise<Result & { pending?: number }> {
  try {
    const ctx = await contextFor(divisionId);
    if (!["pools", "pools_done"].includes(ctx.division.bracket_state)) return { error: "There's no pool stage to close." };
    const pool = ctx.matches.filter((m) => m.stage === "pool");
    const unfinished = pool.filter((m) => m.status === "scheduled" || m.status === "in_progress");
    if (unfinished.length && !force) {
      return { error: `${unfinished.length} pool ${unfinished.length === 1 ? "match is" : "matches are"} not finished.`, pending: unfinished.length };
    }
    if (unfinished.length) {
      await writePatches(unfinished.map((m) => ({ id: m.id, status: "cancelled" as const })));
      unfinished.forEach((m) => (m.status = "cancelled"));
    }

    // withdrawn teams stay in the table (their walkovers count for opponents) but can't advance
    const everyone = ctx.allEntries.map(({ id, name }) => ({ id, name }));
    const standings = new Map(
      [...poolStandings(ctx.config, everyone, pool).entries()].map(([k, rows]) => [
        k,
        rows.filter((r) => !ctx.withdrawn.has(r.id)),
      ])
    );
    const knockout = knockoutFromPools(ctx.config, standings, ctx.entries, {
      startAt: nextMatchNumber(ctx.matches),
      withdrawn: ctx.withdrawn,
    });
    await insertMatches(knockout, ctx.division.tournament_id, divisionId);
    await setDivisionState(divisionId, "final");
    await revalidateDraw(ctx.division.tournament_id, divisionId);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function nextSwissRoundAction(divisionId: string): Promise<Result> {
  try {
    const ctx = await contextFor(divisionId);
    if (ctx.config.final.type !== "swiss" || ctx.division.bracket_state !== "final") {
      return { error: "This category isn't playing Swiss rounds." };
    }
    const swiss = ctx.matches.filter((m) => m.stage === "swiss");
    if (!stageDone(swiss)) return { error: "Finish the current round first." };
    const round = currentSwissRound(swiss);
    if (round >= ctx.config.final.rounds) return { error: "All rounds have been played." };

    // after pools, only the teams that went through play the Swiss rounds
    const inSwiss = new Set(swiss.flatMap((m) => [m.a, m.b]).filter(Boolean) as string[]);
    const entries = ctx.entries.filter((e) => inSwiss.has(e.id));
    const next = nextSwissRound(ctx.config, entries, swiss, { startAt: nextMatchNumber(ctx.matches) });
    await insertMatches(next, ctx.division.tournament_id, divisionId);
    await revalidateDraw(ctx.division.tournament_id, divisionId);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Withdraws an entry; once the bracket is running their pending matches become walkovers. */
export async function withdrawEntryAction(registrationId: string, withdraw = true): Promise<Result> {
  try {
    const admin = createAdminClient();
    const { data: reg } = await admin.from("registrations").select("division_id").eq("id", registrationId).maybeSingle();
    if (!reg) return { error: "Entry not found" };
    const ctx = await contextFor(reg.division_id);
    if (!withdraw && ctx.division.bracket_state !== "not_started") {
      return { error: "Entries can only be reinstated before the bracket starts." };
    }
    await admin
      .from("registrations")
      .update({ withdrawn_at: withdraw ? new Date().toISOString() : null })
      .eq("id", registrationId);

    if (withdraw && ctx.division.bracket_state !== "not_started") {
      ctx.withdrawn.add(registrationId);
      const patches = resolvePending(ctx.matches, { names: ctx.names, withdrawn: ctx.withdrawn });
      await writePatches(patches);
      const byId = new Map(ctx.matches.map((m) => [m.id, m]));
      for (const p of patches) Object.assign(byId.get(p.id)!, p);
      await refreshDivisionState(ctx, [...byId.values()]);
    }
    await revalidateDraw(ctx.division.tournament_id, ctx.division.id);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Organizer types in the final game scores (e.g. from a paper sheet). */
export async function enterResultAction(matchId: string, games: GameScore[]): Promise<Result> {
  try {
    const admin = createAdminClient();
    const { data: match } = await admin.from("matches").select("*").eq("id", matchId).maybeSingle();
    if (!match) return { error: "Match not found" };
    await requireOrganizerForTournament(match.tournament_id);
    if (!match.team_a_registration_id || !match.team_b_registration_id) {
      return { error: "Both teams need to be known before a result can be entered." };
    }
    if (match.status === "completed" || match.status === "walkover") {
      return { error: "This match already has a result — use Correct result first." };
    }
    const clean = games.filter(([a, b]) => a > 0 || b > 0);
    if (!clean.length) return { error: "Enter at least one game." };
    if (clean.some(([a, b]) => a === b || a < 0 || b < 0)) return { error: "A game can't end level." };

    const gamesA = clean.filter(([a, b]) => a > b).length;
    const gamesB = clean.length - gamesA;
    if (gamesA === gamesB) return { error: "The games are level — who won the match?" };

    await admin
      .from("matches")
      .update({
        games_won_a: gamesA,
        games_won_b: gamesB,
        score_a: 0,
        score_b: 0,
        current_game: clean.length + 1,
        status: "completed",
        completed_at: new Date().toISOString(),
        game_scores: clean,
      })
      .eq("id", matchId);
    await advanceAfterResult(matchId, gamesA > gamesB ? "a" : "b", clean);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Reopens a finished match, as long as the matches it fed haven't started. */
export async function correctResultAction(matchId: string): Promise<Result> {
  try {
    const admin = createAdminClient();
    const { data: row } = await admin.from("matches").select("division_id, tournament_id").eq("id", matchId).maybeSingle();
    if (!row?.division_id) return { error: "Match not found" };
    const ctx = await contextFor(row.division_id);
    const result = revertResult(ctx.matches, matchId);
    if ("error" in result) return { error: result.error };
    await writePatches(result.patches);
    await admin
      .from("matches")
      .update({ score_a: 0, score_b: 0, games_won_a: 0, games_won_b: 0, current_game: 1, completed_at: null })
      .eq("id", matchId);
    await admin.from("match_scores").delete().eq("match_id", matchId);

    // a corrected result can reopen a finished stage
    const reopened = ctx.matches.find((m) => m.id === matchId)!;
    if (ctx.division.bracket_state === "complete") await setDivisionState(ctx.division.id, "final");
    if (ctx.division.bracket_state === "pools_done" && reopened.stage === "pool") {
      await setDivisionState(ctx.division.id, "pools");
    }
    await revalidateDraw(ctx.division.tournament_id, ctx.division.id);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Deletes the draw. Needs the category name typed in if any match has been played. */
export async function resetBracketAction(divisionId: string, confirmName?: string): Promise<Result & { needsConfirm?: boolean }> {
  try {
    const ctx = await contextFor(divisionId);
    const played = ctx.matches.some(
      (m) => !m.isBye && (m.status === "completed" || m.status === "in_progress" || (m.scoreA ?? 0) > 0 || (m.scoreB ?? 0) > 0)
    );
    if (played && confirmName?.trim() !== ctx.division.name) {
      return { error: "Matches have been played. Type the category name to confirm.", needsConfirm: true };
    }
    const admin = createAdminClient();
    await admin.from("matches").delete().eq("division_id", divisionId).not("stage", "is", null);
    await setDivisionState(divisionId, "not_started", { bracket_started_at: null });
    await revalidateDraw(ctx.division.tournament_id, divisionId);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Optional: copies the format and the players (in seed order) to a new Challonge bracket. */
export async function exportToChallongeAction(divisionId: string): Promise<Result & { url?: string }> {
  try {
    const ctx = await contextFor(divisionId);
    const user = await requireOrganizerForTournament(ctx.division.tournament_id);
    const { ChallongeService } = await import("@/lib/services/challonge/challonge-service");
    const service = await ChallongeService.forUser(user.id);
    if (!service) return { error: "Connect Challonge in Settings → Connections first." };
    if (!ctx.entries.length) return { error: "There are no confirmed entries to export yet." };

    const { data: t } = await createAdminClient()
      .from("tournaments")
      .select("name, slug, start_date")
      .eq("id", ctx.division.tournament_id)
      .single();
    const slug = `rmt_${(t?.slug ?? "event").replace(/[^a-z0-9]/gi, "_").slice(0, 36)}_${divisionId.replace(/-/g, "").slice(0, 8)}_${Date.now().toString(36)}`;
    const created = await service.createBracketForDivision(
      divisionId,
      toChallongeTournament(ctx.config, {
        name: `${t?.name ?? "Tournament"} — ${ctx.division.name}`,
        url: slug.toLowerCase(),
        startsAt: t?.start_date ? `${t.start_date}T08:00:00+08:00` : null,
      })
    );
    await service.bulkAddParticipants(created.id, ctx.entries.map((e) => e.name));
    await revalidateDraw(ctx.division.tournament_id, divisionId);
    return { ok: true, url: created.url };
  } catch (e) {
    return fail(e);
  }
}
