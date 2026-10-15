"use client";

import Link from "next/link";
import { useState } from "react";
import { FileText, List, Loader2 } from "lucide-react";
import { getMyPetitionEligibilityAction } from "@/app/actions/petitions";
import { getPublicDivisionRosterAction } from "@/app/actions/public-roster";
import { PetitionSubmitDialog } from "@/components/petitions/petition-submit-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { entrantNoun } from "@/lib/categories";

type Eligibility = Awaited<ReturnType<typeof getMyPetitionEligibilityAction>>;

export function DivisionRosterButton({
  tournamentSlug,
  tournamentId,
  divisionId,
  format,
}: {
  tournamentSlug: string;
  tournamentId: string;
  divisionId: string;
  format: string;
}) {
  const [open, setOpen] = useState(false);
  const [petitionOpen, setPetitionOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Awaited<ReturnType<typeof getPublicDivisionRosterAction>> | null>(
    null
  );
  const [eligibility, setEligibility] = useState<Eligibility | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const [res, elig] = await Promise.all([
      getPublicDivisionRosterAction(tournamentSlug, divisionId),
      getMyPetitionEligibilityAction(tournamentSlug, divisionId),
    ]);
    setLoading(false);
    if ("error" in res && res.error) {
      setError(res.error);
      setData(null);
    } else {
      setData(res);
    }
    if (!("error" in elig && elig.error)) {
      setEligibility(elig);
    } else {
      setEligibility(null);
    }
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) load();
  }

  function refreshEligibility() {
    void getMyPetitionEligibilityAction(tournamentSlug, divisionId).then((elig) => {
      if (!("error" in elig && elig.error)) setEligibility(elig);
    });
  }

  const roster = data && !("error" in data) ? data : null;
  const elig = eligibility && !("error" in eligibility) ? eligibility : null;

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(true)}>
        <List className="size-4" />
        Entries
      </Button>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[min(85vh,32rem)] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{roster?.divisionName ?? "Category entries"}</DialogTitle>
            <DialogDescription>
              {roster
                ? roster.capacity
                  ? `${roster.taken} of ${roster.capacity} ${entrantNoun(format, roster.capacity)} reserved`
                  : `${roster.taken} ${entrantNoun(format, roster.taken || 1)} registered`
                : "Who has reserved a slot and who is on the waitlist."}
            </DialogDescription>
          </DialogHeader>

          {loading && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading…
            </p>
          )}
          {error && <p className="text-sm text-[#e58a72]">{error}</p>}

          {elig && !loading && (
            <section className="rounded-xl border border-line bg-espresso/30 px-3 py-3">
              <h3 className="eyebrow">Entry petition</h3>
              {elig.reason === "not_signed_in" && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Sign in to submit a petition about your entry in this category.
                </p>
              )}
              {elig.reason === "invite_pending" && (
                <p className="mt-2 text-sm text-muted-foreground">
                  You were added as a partner here. Accept your invite first to file a petition.{" "}
                  {elig.inviteToken && (
                    <Link href={`/invite/${elig.inviteToken}`} className="font-medium text-bone underline underline-offset-4">
                      Open invite
                    </Link>
                  )}
                </p>
              )}
              {elig.reason === "not_registered" && (
                <p className="mt-2 text-sm text-muted-foreground">
                  You must be registered in this category to submit a petition.
                </p>
              )}
              {elig.existingPetition && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <StatusBadge status={elig.existingPetition.status} />
                  <span className="text-xs text-muted-foreground">
                    Submitted {new Date(elig.existingPetition.createdAt).toLocaleDateString()}
                  </span>
                </div>
              )}
              {elig.existingPetition?.status === "rejected" && elig.existingPetition.reviewerNote && (
                <p className="mt-2 text-sm text-muted-foreground">{elig.existingPetition.reviewerNote}</p>
              )}
              {elig.eligible && elig.registrationId && elig.entryName && (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="mt-3"
                  onClick={() => setPetitionOpen(true)}
                >
                  <FileText className="size-4" />
                  Submit petition
                </Button>
              )}
              {elig.reason === "pending_exists" && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Your petition is under review. You can submit again if it is rejected.
                </p>
              )}
            </section>
          )}

          {roster && !loading && (
            <div className="space-y-6">
              <section>
                <h3 className="eyebrow">Reserved slots</h3>
                {roster.slots.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">No entries yet.</p>
                ) : (
                  <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
                    {roster.slots.map((e, i) => (
                      <li
                        key={`${e.name}-${i}`}
                        className="flex items-center justify-between gap-3 bg-surface px-3 py-2.5 text-sm"
                      >
                        <span className="min-w-0 truncate font-medium text-bone">{e.name}</span>
                        <StatusBadge status={e.status} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <h3 className="eyebrow">Waitlist</h3>
                {roster.waitlist.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">No one on the waitlist.</p>
                ) : (
                  <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
                    {roster.waitlist.map((e, i) => (
                      <li
                        key={`wl-${e.name}-${i}`}
                        className="flex items-center justify-between gap-3 bg-surface px-3 py-2.5 text-sm"
                      >
                        <span className="min-w-0 truncate font-medium text-bone">{e.name}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">{e.statusLabel}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {elig?.eligible && elig.registrationId && elig.entryName && (
        <PetitionSubmitDialog
          open={petitionOpen}
          onOpenChange={setPetitionOpen}
          tournamentId={tournamentId}
          registrationId={elig.registrationId}
          entryName={elig.entryName}
          onSubmitted={refreshEligibility}
        />
      )}
    </>
  );
}
