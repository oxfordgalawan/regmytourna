"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { ClaimMatchDialog } from "@/components/umpire/claim-match-dialog";
import { NAV_FORWARD } from "@/lib/nav-transitions";
import { Button } from "@/components/ui/button";
export type QueueMatch = {
  id: string;
  status: string;
  teamA: string;
  teamB: string;
  divisionName: string | null;
  courtName: string | null;
  label: string;
  assigneeName: string | null;
  assigneeId: string | null;
  canClaim: boolean;
  isMine: boolean;
};

export function UmpireQueue({
  tournamentId,
  matches,
}: {
  tournamentId: string;
  matches: QueueMatch[];
}) {
  const [claimId, setClaimId] = useState<string | null>(null);
  const claimMatch = matches.find((m) => m.id === claimId);

  const scheduled = matches.filter((m) => m.status === "scheduled");
  const live = matches.filter((m) => m.status === "in_progress");

  return (
    <div className="space-y-8">
      {live.length > 0 && (
        <section>
          <h2 className="eyebrow">Live now</h2>
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line">
            {live.map((m) => (
              <QueueRow
                key={m.id}
                m={m}
                tournamentId={tournamentId}
                onClaim={() => setClaimId(m.id)}
              />
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="eyebrow">Up next</h2>
        {scheduled.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No scheduled matches ready right now.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line">
            {scheduled.map((m) => (
              <QueueRow
                key={m.id}
                m={m}
                tournamentId={tournamentId}
                onClaim={() => setClaimId(m.id)}
              />
            ))}
          </ul>
        )}
      </section>

      <ClaimMatchDialog
        open={Boolean(claimId)}
        onOpenChange={(o) => !o && setClaimId(null)}
        tournamentId={tournamentId}
        matchId={claimId}
        matchLabel={
          claimMatch
            ? `${claimMatch.teamA} vs ${claimMatch.teamB}${claimMatch.divisionName ? ` · ${claimMatch.divisionName}` : ""}`
            : ""
        }
      />
    </div>
  );
}

function QueueRow({
  m,
  tournamentId,
  onClaim,
}: {
  m: QueueMatch;
  tournamentId: string;
  onClaim: () => void;
}) {
  return (
    <li className="flex flex-col gap-2 bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">
          {[m.divisionName, m.courtName, m.label].filter(Boolean).join(" · ")}
        </p>
        <p className="mt-1 font-medium text-bone">
          {m.teamA}
          <span className="mx-2 font-mono text-xs text-muted-foreground">vs</span>
          {m.teamB}
        </p>
        {m.assigneeName && (
          <p className="mt-1 text-xs text-brass">Umpire: {m.assigneeName}</p>
        )}
      </div>
      <div className="flex shrink-0 gap-2">
        {m.canClaim && (
          <Button size="sm" variant="outline" onClick={onClaim}>
            Claim
          </Button>
        )}
        {m.isMine && (
          <Button size="sm" asChild>
            <Link href={`/umpire/${tournamentId}/match/${m.id}`} transitionTypes={NAV_FORWARD}>
              Score
              <ChevronRight className="size-4" />
            </Link>
          </Button>
        )}
      </div>
    </li>
  );
}
