import Link from "next/link";
import { CalendarDays, CheckCircle2, Clock, UserPlus } from "lucide-react";
import { InviteActions } from "@/components/invites/invite-actions";
import { acceptInviteForMeAction, declineInviteForMeAction } from "@/app/actions/partner-invites";
import type { PartnerInvite } from "@/lib/registrations/partner-invites";
import { formatDateRange } from "@/lib/format";

/** "Juan added you as partner" — invites sent to this account's email, waiting for Accept / Not me. */
export function PartnerInvitesCard({ invites }: { invites: PartnerInvite[] }) {
  if (!invites.length) return null;
  return (
    <section className="animate-rise space-y-3" aria-labelledby="invites-heading">
      <h2 id="invites-heading" className="flex items-center gap-2 text-lg font-semibold text-bone">
        <UserPlus className="size-5 text-brass" />
        {invites.length === 1 ? "You were added as partner" : `You were added as partner in ${invites.length} entries`}
      </h2>
      <div className="grid gap-3 xl:grid-cols-2">
        {invites.map((i) => (
          <article key={i.rowId} className="relative overflow-hidden rounded-2xl border border-brass/40 bg-espresso p-5">
            <div className="court-grid pointer-events-none absolute inset-0 opacity-30" />
            <div className="relative space-y-4">
              <div>
                <p className="text-sm text-bone/80">
                  <span className="font-semibold text-bone">{i.registrantName}</span> added you to
                </p>
                <p className="mt-1 text-lg font-semibold text-bone">{i.categoryName}</p>
                <Link
                  href={`/tournaments/${i.tournament.slug}#entries`}
                  className="text-sm text-bone/80 underline-offset-4 hover:underline"
                >
                  {i.tournament.name}
                </Link>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <CalendarDays className="size-3.5" />
                    {formatDateRange(i.tournament.startDate, i.tournament.endDate)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    {i.paymentStatus === "paid" ? (
                      <CheckCircle2 className="size-3.5 text-brass" />
                    ) : (
                      <Clock className="size-3.5" />
                    )}
                    {i.paymentStatus === "paid" ? "Paid" : "Payment pending"}
                  </span>
                </div>
              </div>
              <InviteActions
                compact
                acceptLabel="Accept"
                afterAccept={null}
                accept={acceptInviteForMeAction.bind(null, i.rowId)}
                decline={declineInviteForMeAction.bind(null, i.rowId)}
              />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
