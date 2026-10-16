import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, LogIn, MapPin, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InviteActions } from "@/components/invites/invite-actions";
import { acceptCoOrganizerInviteAction, declineCoOrganizerInviteAction } from "@/app/actions/organizer-team";
import { findInvite, isMember } from "@/lib/organizers/team";
import { getOptionalUser } from "@/lib/auth/require-user";
import { normalizePartnerEmail } from "@/lib/registrations/partner-conflicts";
import { formatDateRange } from "@/lib/format";

export const metadata = { title: "Co-organizer invite", robots: { index: false } };

function Message({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center sm:px-6">
      <h1 className="display text-4xl text-bone">{title}</h1>
      <p className="mt-3 text-muted-foreground">{body}</p>
      <Button variant="outline" className="mt-8" asChild>
        <Link href="/dashboard">Go to my dashboard</Link>
      </Button>
    </div>
  );
}

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [invite, user] = await Promise.all([findInvite(token), getOptionalUser()]);
  if (!invite) return <Message title="This link isn't valid" body="Ask the organizer to send you a new invite." />;

  const t = invite.tournament;
  if (user && (await isMember(t.id, user.id))) redirect(`/organizer/tournaments/${t.id}`);
  if (invite.status === "revoked") {
    return <Message title="This invite was turned off" body="Ask the organizer for a new link." />;
  }
  if (invite.status !== "pending") {
    return <Message title="This invite was already used" body="Ask the organizer to invite you again if you need access." />;
  }

  const self = `/join/${token}`;
  const wrongEmail =
    user && invite.kind === "email" && invite.email && normalizePartnerEmail(invite.email) !== normalizePartnerEmail(user.email ?? "");
  const signupHref = `/signup?${new URLSearchParams({
    type: "organizer",
    next: self,
    ...(invite.email ? { email: invite.email } : {}),
  })}`;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-16">
      <article className="grain relative animate-rise overflow-hidden rounded-3xl border border-umber bg-espresso">
        {t.cover_image_url && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={t.cover_image_url} alt="" className="absolute inset-0 size-full object-cover opacity-25" />
            <div className="absolute inset-0 bg-gradient-to-b from-espresso/60 via-espresso/90 to-espresso" />
          </>
        )}
        <div className="court-grid pointer-events-none absolute inset-0 opacity-30" />
        <div className="relative p-6 sm:p-10">
          <p className="eyebrow text-brass">Co-organizer invite</p>
          <h1 className="display mt-3 text-4xl text-bone text-balance sm:text-5xl">
            {invite.inviterName} wants your help running {t.name}
          </h1>
          <div className="mt-5 flex flex-col gap-1.5 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-x-5">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="size-3.5" />
              {formatDateRange(t.start_date, t.end_date)}
            </span>
            {(t.venue_name || t.city) && (
              <span className="flex items-center gap-1.5">
                <MapPin className="size-3.5" />
                {[t.venue_name, t.city].filter(Boolean).join(", ")}
              </span>
            )}
          </div>
          <p className="mt-6 text-sm text-bone/75">
            You&apos;ll be able to manage categories, players, brackets, the match queue, courts and umpires. Payouts
            stay with the event owner.
          </p>

          <div className="mt-8">
            {!user ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Button size="lg" asChild>
                  <Link href={signupHref}>
                    <UserPlus />
                    Create free account
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href={`/login?next=${encodeURIComponent(self)}`}>
                    <LogIn />I have an account
                  </Link>
                </Button>
              </div>
            ) : wrongEmail ? (
              <p className="rounded-xl border border-brass/40 bg-brass/[0.06] px-4 py-3 text-sm text-bone">
                This invite was sent to <span className="font-semibold">{invite.email}</span>, but you&apos;re signed in
                as {user.email}. Sign out and sign in with that email to accept.
              </p>
            ) : (
              <InviteActions
                acceptLabel="Accept — join the team"
                afterAccept={`/organizer/tournaments/${t.id}`}
                accept={acceptCoOrganizerInviteAction.bind(null, token)}
                decline={declineCoOrganizerInviteAction.bind(null, token)}
                copy={{
                  decline: invite.kind === "email" ? "Decline" : "Not now",
                  confirmDecline:
                    invite.kind === "email" ? "Decline this invite? The organizer can invite you again." : "Close this invite?",
                  confirmDeclineButton: invite.kind === "email" ? "Yes, decline" : "Close",
                  declined: "Okay — no changes made.",
                  accepted: "You're on the team. Opening the event…",
                }}
              />
            )}
          </div>
        </div>
      </article>
    </div>
  );
}
