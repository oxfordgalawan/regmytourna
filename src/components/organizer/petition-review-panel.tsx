"use client";

import { useState, useTransition } from "react";
import { Eye, Loader2 } from "lucide-react";
import { toast } from "@/lib/ui/app-toast";
import {
  getPetitionProofSignedUrlsAction,
  reviewPetitionAction,
  type OrganizerPetitionRow,
} from "@/app/actions/petitions";
import { PetitionImageViewer } from "@/components/petitions/petition-image-viewer";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function PetitionReviewPanel({
  tournamentId,
  initialRows,
}: {
  tournamentId: string;
  initialRows: OrganizerPetitionRow[];
}) {
  const [rows, setRows] = useState(initialRows);
  const [pending, startTransition] = useTransition();
  const [noteById, setNoteById] = useState<Record<string, string>>({});
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerSlides, setViewerSlides] = useState<Array<{ path: string; url: string | null }>>([]);
  const [rejectTarget, setRejectTarget] = useState<OrganizerPetitionRow | null>(null);

  async function openViewer(row: OrganizerPetitionRow) {
    const paths = row.images.map((i) => i.storagePath);
    setViewerSlides(paths.map((path) => ({ path, url: null })));
    setViewerOpen(true);
    const res = await getPetitionProofSignedUrlsAction(tournamentId, paths);
    const urls = res.urls ?? {};
    setViewerSlides(paths.map((path) => ({ path, url: urls[path] ?? null })));
  }

  function review(petitionId: string, status: "approved" | "rejected") {
    startTransition(async () => {
      const res = await reviewPetitionAction(tournamentId, petitionId, status, noteById[petitionId]);
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(status === "approved" ? "Petition approved." : "Petition rejected.");
      setRows((prev) =>
        prev.map((r) =>
          r.id === petitionId
            ? {
                ...r,
                status,
                reviewerNote: noteById[petitionId]?.trim() || null,
                reviewedAt: new Date().toISOString(),
              }
            : r
        )
      );
      setRejectTarget(null);
    });
  }

  if (!rows.length) {
    return (
      <p className="rounded-2xl border border-dashed border-line px-5 py-10 text-center text-sm text-muted-foreground">
        No entry petitions yet.
      </p>
    );
  }

  return (
    <>
      <ul className="divide-y divide-line rounded-2xl border border-line">
        {rows.map((row) => (
          <li key={row.id} className="space-y-3 bg-surface px-4 py-4 sm:px-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="font-medium text-bone">{row.entryName}</p>
                <p className="text-sm text-muted-foreground">
                  {row.divisionName} · submitted by {row.submitterName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(row.createdAt).toLocaleString()}
                </p>
              </div>
              <StatusBadge status={row.status} />
            </div>

            <p className="text-sm text-bone/90 whitespace-pre-wrap">{row.reason}</p>

            {row.reviewerNote && row.status !== "pending" && (
              <p className="rounded-lg bg-umber/30 px-3 py-2 text-sm text-muted-foreground">
                <span className="font-medium text-bone">Organizer note:</span> {row.reviewerNote}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2">
              {row.imageCount > 0 && (
                <Button type="button" size="sm" variant="outline" onClick={() => openViewer(row)}>
                  <Eye className="size-4" />
                  View proof ({row.imageCount})
                </Button>
              )}

              {row.status === "pending" && (
                <>
                  <Textarea
                    placeholder="Optional note to the player (included in email if you reject or approve)"
                    rows={2}
                    className="min-h-0 w-full sm:max-w-md"
                    value={noteById[row.id] ?? ""}
                    onChange={(e) => setNoteById((m) => ({ ...m, [row.id]: e.target.value }))}
                    disabled={pending}
                  />
                  <div className="flex w-full gap-2 sm:w-auto">
                    <Button
                      type="button"
                      size="sm"
                      disabled={pending}
                      onClick={() => review(row.id, "approved")}
                    >
                      {pending ? <Loader2 className="size-4 animate-spin" /> : null}
                      Approve
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={pending}
                      onClick={() => setRejectTarget(row)}
                    >
                      Reject
                    </Button>
                  </div>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>

      <PetitionImageViewer
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        title="Petition proof"
        slides={viewerSlides}
      />

      <Dialog open={Boolean(rejectTarget)} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reject petition?</DialogTitle>
            <DialogDescription>
              The player will be emailed that this petition was not approved. You can add an optional
              note above.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setRejectTarget(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={() => rejectTarget && review(rejectTarget.id, "rejected")}
            >
              Reject petition
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
