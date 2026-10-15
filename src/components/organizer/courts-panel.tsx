"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  MoreHorizontal,
  Pencil,
  Plus,
  Power,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  addCourtAction,
  deleteCourtAction,
  setCourtActiveAction,
  updateCourtAction,
} from "@/app/actions/courts";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type CourtRow = { id: string; name: string; sort_order: number; active: boolean };

export function CourtsPanel({
  tournamentId,
  courts,
}: {
  tournamentId: string;
  courts: CourtRow[];
}) {
  const router = useRouter();
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [editing, setEditing] = useState<CourtRow | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const suggestedName = useMemo(() => {
    const nums = courts
      .map((c) => /^court\s*(\d+)$/i.exec(c.name.trim())?.[1])
      .filter(Boolean)
      .map(Number);
    const next = nums.length ? Math.max(...nums) + 1 : courts.length + 1;
    return `Court ${next}`;
  }, [courts]);

  function openAdd() {
    setEditing(null);
    setName(suggestedName);
    setModal("add");
  }

  function openEdit(court: CourtRow) {
    setEditing(court);
    setName(court.name);
    setModal("edit");
  }

  async function saveCourt() {
    setBusy(true);
    const res =
      modal === "add"
        ? await addCourtAction(tournamentId, name)
        : editing
          ? await updateCourtAction(tournamentId, editing.id, name)
          : { error: "Nothing to save" };
    setBusy(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(modal === "add" ? "Court added" : "Court updated");
    setModal(null);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Each court has its own scoring link. Disable courts you are not using for this event.
        </p>
        <Button onClick={openAdd}>
          <Plus />
          Add court
        </Button>
      </div>

      {courts.length ? (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {courts.map((c, i) => (
            <li key={c.id} className="relative">
              <div
                className={cn(
                  "court-grid flex aspect-[4/3] flex-col justify-between overflow-hidden rounded-2xl border bg-surface p-5 transition-colors",
                  c.active ? "border-line hover:border-umber" : "border-line/60 opacity-60"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono text-xs text-muted-foreground">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="flex items-center gap-2">
                    {!c.active && (
                      <span className="rounded-full border border-line px-2 py-0.5 text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                        Disabled
                      </span>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        type="button"
                        className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-espresso hover:text-bone"
                        aria-label={`Manage ${c.name}`}
                      >
                        <MoreHorizontal className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(c)}>
                          <Pencil className="size-4" />
                          Edit name
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={async () => {
                            const res = await setCourtActiveAction(tournamentId, c.id, !c.active);
                            if (res.error) toast.error(res.error);
                            else toast.success(c.active ? "Court disabled" : "Court enabled");
                            router.refresh();
                          }}
                        >
                          <Power className="size-4" />
                          {c.active ? "Disable" : "Enable"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={async () => {
                            if (
                              !window.confirm(
                                `Delete ${c.name}? Matches on this court will be unassigned from it.`
                              )
                            ) {
                              return;
                            }
                            const res = await deleteCourtAction(tournamentId, c.id);
                            if (res.error) toast.error(res.error);
                            else toast.success("Court deleted");
                            router.refresh();
                          }}
                        >
                          <Trash2 className="size-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <div className="flex items-end justify-between gap-3">
                  <span className="display text-4xl text-bone">{c.name}</span>
                  {c.active ? (
                    <Link
                      href={`/court/${c.id}`}
                      className="group inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-bone"
                    >
                      Score
                      <ArrowUpRight className="size-4" />
                    </Link>
                  ) : (
                    <span className="text-sm text-muted-foreground">Not in use</span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl border border-dashed border-line px-5 py-10 text-center text-sm text-muted-foreground">
          No courts yet. Tap Add court to create Court 1, Court 2, and so on.
        </p>
      )}

      <Dialog open={modal !== null} onOpenChange={(open) => !open && setModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{modal === "add" ? "Add court" : "Edit court"}</DialogTitle>
            <DialogDescription>
              {modal === "add"
                ? "Name this court for referees and the venue display."
                : "Update how this court appears across the event."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="court-name-modal">Court name</Label>
            <Input
              id="court-name-modal"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Court 1"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), saveCourt())}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setModal(null)} disabled={busy}>
              Cancel
            </Button>
            <Button type="button" onClick={saveCourt} disabled={busy || !name.trim()}>
              {modal === "add" ? "Add court" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
