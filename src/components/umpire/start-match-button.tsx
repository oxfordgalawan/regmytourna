"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play } from "lucide-react";
import { toast } from "sonner";
import { startMatchAction } from "@/app/actions/scoring";
import { Button } from "@/components/ui/button";
import { NAV_FORWARD } from "@/lib/nav-transitions";
import { cn } from "@/lib/utils";

/** Shown only to the umpire who claimed the match: puts it live and opens the scoreboard. */
export function StartMatchButton({
  tournamentId,
  matchId,
  className,
}: {
  tournamentId: string;
  matchId: string;
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function start() {
    if (busy) return;
    setBusy(true);
    const res = await startMatchAction(matchId);
    if (res.error) {
      setBusy(false);
      toast.error(res.error);
      return;
    }
    router.push(`/umpire/${tournamentId}/match/${matchId}`, { transitionTypes: NAV_FORWARD });
  }

  return (
    <Button size="sm" className={cn("h-9 shrink-0", className)} disabled={busy} onClick={start}>
      {busy ? <Loader2 className="animate-spin" /> : <Play />}
      Start match
    </Button>
  );
}
