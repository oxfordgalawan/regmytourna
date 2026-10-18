"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, FileSpreadsheet, Loader2, Plus, Upload, UserRoundPen, Users, X } from "lucide-react";
import { toast } from "@/lib/ui/app-toast";
import { addImportedPlayerAction } from "@/app/actions/player-import";
import { cancelEntryAction } from "@/app/actions/walk-in";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { CheckInButton } from "@/components/organizer/check-in-button";
import { ImportPlayersDialog } from "@/components/organizer/import-players-dialog";
import { ReplacePlayerDialog, type ReplaceTarget } from "@/components/organizer/replace-player-dialog";
import { PlayerAvatar } from "@/components/players/player-avatar";
import { entrantNoun } from "@/lib/categories";
import type { RosterCategory, RosterEntry } from "@/lib/import/server";
import { cn } from "@/lib/utils";

/** Players tab for bracket-only events: import from Excel, add by hand, tidy the list. */
export function PlayersRoster({ tournamentId, categories }: { tournamentId: string; categories: RosterCategory[] }) {
  const router = useRouter();
  const [importing, setImporting] = useState(false);
  const [adding, setAdding] = useState<string | null>(null); // divisionId to preselect, or "" for none
  const [replacing, setReplacing] = useState<ReplaceTarget | null>(null);
  const [, startTransition] = useTransition();
  const total = categories.reduce((n, c) => n + c.entries.length, 0);
  const templateHref = `/organizer/tournaments/${tournamentId}/players/template`;

  function remove(e: RosterEntry, category: string) {
    const name = e.players.map((p) => p.name).join(" & ");
    if (!window.confirm(`Remove ${name} from ${category}?`)) return;
    startTransition(async () => {
      const res = await cancelEntryAction(e.id);
      if (res.error) toast.error(res.error);
      else {
        toast.success(`${name} removed`);
        router.refresh();
      }
    });
  }

  if (!categories.length) {
    return (
      <div className="rounded-2xl border border-dashed border-line px-6 py-14 text-center">
        <p className="font-semibold text-bone">Add your categories first</p>
        <p className="mt-1 text-sm text-muted-foreground">
          The import template lists your categories, so set them up on the Categories tab.
        </p>
        <Button className="mt-5" asChild>
          <a href={`/organizer/tournaments/${tournamentId}/divisions`}>Go to Categories</a>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {total === 0 ? (
        <section className="grain relative overflow-hidden rounded-3xl border border-umber bg-espresso p-6 sm:p-8">
          <div className="court-grid pointer-events-none absolute inset-0 opacity-30" />
          <div className="relative">
            <p className="eyebrow text-brass">Bring your player list</p>
            <h2 className="display mt-2 text-4xl text-bone sm:text-5xl">Three steps to your brackets</h2>
            <ol className="mt-6 grid gap-3 md:grid-cols-3">
              {(
                [
                  [Download, "Download the template", "An Excel file with a tab for each of your categories."],
                  [FileSpreadsheet, "Fill in your players", "Each category has its own tab. One team per row — Player 2 is the partner."],
                  [Upload, "Upload it", "Check the preview, then import every category at once."],
                ] as const
              ).map(([Icon, title, body], i) => (
                <li key={title} className="rounded-2xl border border-line bg-ink/40 p-4">
                  <span className="flex items-center gap-2 font-mono text-xs text-brass">
                    0{i + 1}
                    <Icon className="size-4" />
                  </span>
                  <p className="mt-2 font-semibold text-bone">{title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{body}</p>
                </li>
              ))}
            </ol>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button size="lg" variant="outline" className="bg-ink/30" asChild>
                <a href={templateHref} download>
                  <Download />
                  Download template
                </a>
              </Button>
              <Button size="lg" onClick={() => setImporting(true)}>
                <Upload />
                Upload player list
              </Button>
              <Button size="lg" variant="ghost" onClick={() => setAdding("")}>
                <Plus />
                Add one by hand
              </Button>
            </div>
          </div>
        </section>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-bone">{total}</span> {total === 1 ? "entry" : "entries"} across{" "}
            {categories.length} {categories.length === 1 ? "category" : "categories"}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" asChild>
              <a href={templateHref} download>
                <Download />
                Template
              </a>
            </Button>
            <Button size="sm" variant="outline" onClick={() => setAdding("")}>
              <Plus />
              Add player
            </Button>
            <Button size="sm" onClick={() => setImporting(true)}>
              <Upload />
              Import
            </Button>
          </div>
        </div>
      )}

      {total > 0 &&
        categories.map((c) => (
          <section key={c.id} className="overflow-hidden rounded-2xl border border-line">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3">
              <div className="min-w-0">
                <h3 className="truncate font-semibold text-bone">{c.name}</h3>
                <p className="text-xs text-muted-foreground">
                  {c.entries.length}
                  {c.capacity ? `/${c.capacity}` : ""} {entrantNoun(c.format, c.entries.length || 2)}
                  {c.drawStarted && " · draw started"}
                </p>
              </div>
              {!c.drawStarted && (
                <Button size="sm" variant="ghost" onClick={() => setAdding(c.id)}>
                  <Plus />
                  Add
                </Button>
              )}
            </header>
            {c.entries.length === 0 ? (
              <p className="bg-surface/50 px-4 py-5 text-sm text-muted-foreground">No players yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {c.entries.map((e, i) => (
                  <li key={e.id} className="flex items-center gap-3 bg-surface/50 px-4 py-2.5">
                    <span className="w-8 shrink-0 font-mono text-xs text-muted-foreground">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="flex shrink-0 -space-x-2">
                      {e.players.map((p) => (
                        <PlayerAvatar key={p.rowId} name={p.name} className="size-8 text-[0.65rem]" />
                      ))}
                    </div>
                    <span className="min-w-0 flex-1 truncate text-sm text-bone">
                      {e.players.map((p) => p.name).join(" & ")}
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      <CheckInButton tournamentId={tournamentId} registrationId={e.id} checkedIn={e.checkedIn} />
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        title="Edit names"
                        aria-label={`Edit ${e.players.map((p) => p.name).join(" & ")}`}
                        onClick={() =>
                          setReplacing({
                            registrationId: e.id,
                            division: c.name,
                            walkIn: true,
                            players: e.players.map((p) => ({ ...p, email: null })),
                          })
                        }
                      >
                        <UserRoundPen />
                      </Button>
                      {!c.drawStarted && (
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          title="Remove"
                          aria-label={`Remove ${e.players.map((p) => p.name).join(" & ")}`}
                          onClick={() => remove(e, c.name)}
                        >
                          <X />
                        </Button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}

      <ImportPlayersDialog
        tournamentId={tournamentId}
        categories={categories.map((c) => ({ id: c.id, name: c.name, format: c.format }))}
        open={importing}
        onOpenChange={setImporting}
      />
      {adding !== null && (
        <AddPlayerDialog
          tournamentId={tournamentId}
          categories={categories.filter((c) => !c.drawStarted)}
          initial={adding}
          onClose={() => setAdding(null)}
        />
      )}
      {replacing && <ReplacePlayerDialog key={replacing.registrationId} target={replacing} onClose={() => setReplacing(null)} />}
    </div>
  );
}

function AddPlayerDialog({
  tournamentId,
  categories,
  initial,
  onClose,
}: {
  tournamentId: string;
  categories: RosterCategory[];
  initial: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [divisionId, setDivisionId] = useState(initial || categories[0]?.id || "");
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const cat = categories.find((c) => c.id === divisionId);
  const doubles = cat?.format === "doubles";

  function save(keepOpen: boolean) {
    startTransition(async () => {
      const res = await addImportedPlayerAction(tournamentId, { divisionId, p1, p2 });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`${[p1, p2].filter(Boolean).join(" & ")} added`);
      router.refresh();
      if (keepOpen) {
        setP1("");
        setP2("");
      } else onClose();
    });
  }

  const ready = Boolean(divisionId && p1.trim().length >= 2 && (!doubles || p2.trim().length >= 2));

  return (
    <Dialog open onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle>Add {doubles ? "a team" : "a player"}</DialogTitle>
        <DialogDescription>For late additions. For many players, use Import.</DialogDescription>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (ready) save(false);
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="ap-cat">Category</Label>
            <select
              id="ap-cat"
              value={divisionId}
              onChange={(e) => setDivisionId(e.target.value)}
              className="h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm text-bone outline-none focus:border-umber"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className={cn("grid gap-3", doubles && "sm:grid-cols-2")}>
            <div className="space-y-2">
              <Label htmlFor="ap-p1">{doubles ? "Player 1" : "Player"}</Label>
              <Input id="ap-p1" value={p1} onChange={(e) => setP1(e.target.value)} autoFocus autoComplete="off" />
            </div>
            {doubles && (
              <div className="space-y-2">
                <Label htmlFor="ap-p2">Player 2</Label>
                <Input id="ap-p2" value={p2} onChange={(e) => setP2(e.target.value)} autoComplete="off" />
              </div>
            )}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" disabled={pending || !ready} onClick={() => save(true)}>
              <Users />
              Save &amp; add another
            </Button>
            <Button type="submit" disabled={pending || !ready}>
              {pending && <Loader2 className="animate-spin" />}
              Add
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
