"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GitBranch, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { linkChallongeTournamentAction, syncChallongeAction } from "@/app/actions/tournaments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ChallongeLinkPanel({
  tournamentId,
  linkedId,
  linkedUrl,
  syncStatus,
}: {
  tournamentId: string;
  linkedId: string | null;
  linkedUrl: string | null;
  syncStatus: string | null;
}) {
  const router = useRouter();
  const [challongeId, setChallongeId] = useState(linkedId ?? "");
  const [challongeUrl, setChallongeUrl] = useState(linkedUrl ?? "");
  const [busy, setBusy] = useState<"link" | "sync" | null>(null);

  async function saveLink() {
    setBusy("link");
    const result = await linkChallongeTournamentAction(tournamentId, challongeId, challongeUrl);
    setBusy(null);
    if (result.error) toast.error(result.error);
    else {
      toast.success("Bracket linked");
      router.refresh();
    }
  }

  async function sync() {
    setBusy("sync");
    const result = await syncChallongeAction(tournamentId);
    setBusy(null);
    if (result.error) toast.error(result.error);
    else {
      toast.success("Players and matches synced");
      router.refresh();
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line p-6">
        <div className="flex gap-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-umber text-bone">
            <GitBranch className="size-5" />
          </span>
          <div>
            <h3 className="font-semibold text-bone">Challonge bracket</h3>
            <p className="mt-1 max-w-lg text-sm text-muted-foreground">
              Link by the tournament&apos;s Challonge ID. Syncing pushes confirmed entries into the
              bracket and pulls matches back here.
            </p>
          </div>
        </div>
        <span className="rounded-full border border-line px-3 py-1 font-mono text-xs text-muted-foreground">
          {linkedId ? `Sync: ${syncStatus ?? "pending"}` : "Not linked"}
        </span>
      </div>
      <div className="grid gap-4 p-6 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="challonge-id">Challonge tournament ID</Label>
          <Input
            id="challonge-id"
            value={challongeId}
            onChange={(e) => setChallongeId(e.target.value)}
            placeholder="e.g. 12345678"
            className="font-mono"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="challonge-url">Public bracket URL</Label>
          <Input
            id="challonge-url"
            value={challongeUrl}
            onChange={(e) => setChallongeUrl(e.target.value)}
            placeholder="https://challonge.com/…"
          />
        </div>
      </div>
      <div className="flex flex-wrap justify-end gap-2 border-t border-line bg-ink/30 px-6 py-4">
        <Button type="button" variant="outline" onClick={saveLink} disabled={!challongeId || busy !== null}>
          {busy === "link" && <Loader2 className="animate-spin" />}
          Save link
        </Button>
        <Button type="button" onClick={sync} disabled={!linkedId || busy !== null}>
          {busy === "sync" ? <Loader2 className="animate-spin" /> : <RefreshCw />}
          Sync now
        </Button>
      </div>
    </section>
  );
}
