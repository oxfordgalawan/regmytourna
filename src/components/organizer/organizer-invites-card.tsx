import Link from "next/link";
import { UsersRound } from "lucide-react";
import { InviteActions } from "@/components/invites/invite-actions";
import { acceptCoOrganizerInviteAction, declineCoOrganizerInviteAction } from "@/app/actions/organizer-team";
import type { PendingOrganizerInvite } from "@/lib/organizers/team";

/** Pending co-organizer email invites — accept in-app without the email link. */
export function OrganizerInvitesCard({ invites }: { invites: PendingOrganizerInvite[] }) {
  if (!invites.length) return null;
  return (
    <section className="animate-rise space-y-3" aria-label="Co-organizer invites">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-bone">
        <UsersRound className="size-5 text-brass" />
        {invites.length === 1 ? "Co-organizer invite" : `${invites.length} co-organizer invites`}
      </h2>
      <div className="grid gap-3">
        {invites.map((i) => (
          <article
            key={i.token}
            className="flex flex-col gap-4 rounded-2xl border border-brass/40 bg-brass/[0.06] p-4 sm:flex-row sm:flex-wrap sm:items-center"
          >
            <p className="min-w-0 flex-1 text-sm text-bone">
              You&apos;re invited to co-organize{" "}
              <span className="font-semibold">{i.tournamentName}</span>
            </p>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:min-w-[16rem]">
              <InviteActions
                compact
                acceptLabel="Accept"
                afterAccept={`/organizer/tournaments/${i.tournamentId}`}
                accept={acceptCoOrganizerInviteAction.bind(null, i.token)}
                decline={declineCoOrganizerInviteAction.bind(null, i.token)}
                copy={{
                  decline: "Decline",
                  confirmDecline: "Decline this invite? The organizer can invite you again.",
                  confirmDeclineButton: "Yes, decline",
                  declined: "Invite declined.",
                  accepted: "You're on the team. Opening the event…",
                }}
              />
              <Link
                href={`/join/${i.token}`}
                className="text-center text-xs text-muted-foreground underline-offset-4 hover:text-bone hover:underline"
              >
                View event details
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}