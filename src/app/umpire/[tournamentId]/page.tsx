import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUmpireSession } from "@/lib/auth/umpire";
import { UmpireHub } from "@/components/umpire/umpire-hub";
import type { QueueMatch } from "@/components/umpire/umpire-queue";
import { AutoRefresh } from "@/components/display/auto-refresh";
import { isPlayableMatch, sortQueueMatches } from "@/lib/umpire/playable";
import { loadDivisionContext } from "@/lib/draw/server";
import { buildDrawView } from "@/lib/draw/view";

export const metadata = { title: "Umpire hub", robots: { index: false } };

export default async function UmpireBoardPage({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  const { tournamentId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(tournamentId)) notFound();

  const admin = createAdminClient();
  const { data: tournament } = await admin
    .from("tournaments")
    .select("id, name")
    .eq("id", tournamentId)
    .maybeSingle();
  if (!tournament) notFound();

  const session = await getUmpireSession(tournamentId);

  const [{ data: divisions }, { data: courts }, { data: umpires }, { data: matches }] =
    await Promise.all([
      admin
        .from("tournament_divisions")
        .select("id, name, bracket_state")
        .eq("tournament_id", tournamentId)
        .order("sort_order"),
      admin.from("courts").select("id, name").eq("tournament_id", tournamentId).eq("active", true),
      admin.from("tournament_umpires").select("id, name").eq("tournament_id", tournamentId),
      admin
        .from("matches")
        .select(
          "id, status, is_bye, is_conditional, team_a_registration_id, team_b_registration_id, team_a_label, team_b_label, division_id, court_id, round_label, match_number, stage, assigned_umpire_id, umpire_queue_order"
        )
        .eq("tournament_id", tournamentId)
        .in("status", ["scheduled", "in_progress"])
        .order("match_number", { ascending: true, nullsFirst: false }),
    ]);

  const divisionName = new Map((divisions ?? []).map((d) => [d.id, d.name as string]));
  const courtName = new Map((courts ?? []).map((c) => [c.id, c.name as string]));
  const umpireName = new Map((umpires ?? []).map((u) => [u.id, u.name as string]));

  const playable = sortQueueMatches((matches ?? []).filter(isPlayableMatch));

  function toQueueMatch(m: (typeof playable)[0]): QueueMatch {
    const assigneeId = m.assigned_umpire_id as string | null;
    const assigneeName = assigneeId ? (umpireName.get(assigneeId) ?? "Umpire") : null;
    const isMine = Boolean(session && assigneeId === session.id);
    const canClaim = m.status === "scheduled" && !assigneeId;
    return {
      id: m.id,
      status: m.status,
      teamA: m.team_a_label,
      teamB: m.team_b_label,
      divisionName: m.division_id ? (divisionName.get(m.division_id) ?? null) : null,
      courtName: m.court_id ? (courtName.get(m.court_id) ?? null) : null,
      label: m.round_label ?? (m.match_number ? `Match ${m.match_number}` : "Match"),
      assigneeName,
      assigneeId,
      canClaim,
      isMine,
    };
  }

  const queueMatches = playable.map(toQueueMatch);
  const myMatches = queueMatches.filter((m) => m.isMine);

  const startedIds = (divisions ?? [])
    .filter((d) => d.bracket_state && d.bracket_state !== "not_started")
    .map((d) => d.id);
  const bracketCategories = (
    await Promise.all(
      startedIds.map(async (divisionId) => {
        const ctx = await loadDivisionContext(divisionId);
        const div = divisions?.find((d) => d.id === divisionId);
        return ctx && div
          ? { id: divisionId, name: div.name as string, view: buildDrawView(ctx) }
          : null;
      })
    )
  ).filter((d): d is NonNullable<typeof d> => d !== null);

  return (
    <main id="main" className="min-h-dvh bg-background">
      <AutoRefresh seconds={20} clock={false} />
      <UmpireHub
        tournamentId={tournamentId}
        tournamentName={tournament.name}
        sessionUmpire={session}
        queueMatches={queueMatches}
        myMatches={myMatches}
        bracketCategories={bracketCategories}
      />
    </main>
  );
}
