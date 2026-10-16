import Link from "next/link";
import { ArrowRight, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";

/** "You're invited to co-organize X" — on the dashboard until accepted or declined. */
export function OrganizerInvitesCard({ invites }: { invites: Array<{ token: string; tournamentName: string }> }) {
  if (!invites.length) return null;
  return (
    <section className="animate-rise space-y-2" aria-label="Co-organizer invites">
      {invites.map((i) => (
        <div
          key={i.token}
          className="flex flex-wrap items-center gap-3 rounded-2xl border border-brass/40 bg-brass/[0.06] px-4 py-3"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-umber/50 text-brass">
            <UsersRound className="size-5" />
          </span>
          <p className="min-w-0 flex-1 text-sm text-bone">
            You&apos;re invited to co-organize <span className="font-semibold">{i.tournamentName}</span>
          </p>
          <Button size="sm" asChild>
            <Link href={`/join/${i.token}`}>
              View invite
              <ArrowRight />
            </Link>
          </Button>
        </div>
      ))}
    </section>
  );
}
