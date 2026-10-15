import Link from "next/link";
import { ArrowRight, CalendarDays, CheckCircle2, Clock, LogIn, MapPin, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InviteActions } from "@/components/invites/invite-actions";
import { PlayerAvatar } from "@/components/players/player-avatar";
import { acceptSubstituteAction, declineSubstituteAction } from "@/app/actions/team-changes";
import { findSubstitution } from "@/lib/registrations/team-changes";
import { getOptionalUser } from "@/lib/auth/require-user";
import { normalizePartnerEmail } from "@/lib/registrations/partner-conflicts";
import { formatDateRange } from "@/lib/format";
import { NAV_FORWARD } from "@/lib/nav-transitions";

export const metadata = { title: "Take their place", robots: { index: false } };

function Message({ title, body, slug }: { title: string; body: string; slug?: string }) {
  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center sm:px-6">
      <h1 className="display text-4xl text-bone">{title}</h1>
      <p className="mt-3 text-muted-foreground">{body}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-2">
        {slug && (
          <Button asChild>
            <Link href={`/tournaments/${slug}#entries`} transitionTypes={NAV_FORWARD}>
              View the tournament
              <ArrowRight />
            </Link>
          </Button>
        )}
        <Button variant="outline" asChild>
          <Link href="/explore">Browse tournaments</Link>
        </Button>
      </div>
    </div>
  );
}

export default async function SubstitutePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [found, user] = await Promise.all([findSubstitution(token), getOptionalUser()]);
  if (!found) return <Message title="This link isn't valid" body="Ask the player who invited you to send it again." />;

  const { sub, team, leaving } = found;
  const slug = team.slug;
  const self = `/substitute/${token}`;
  if (sub.status === "accepted") {
    const mine = Boolean(user && team.rows.some((r) => r.user_id === user.id));
    return mine ? (
      <Message title="You're on the team." body="This entry is in your account now." slug={slug} />
    ) : (
      <Message title="Already accepted" body="Someone already took this place." slug={slug} />
    );
  }
  if (sub.status === "declined") {
    return <Message title="You declined" body="We let them know. Thanks for answering!" slug={slug} />;
  }
  if (sub.status !== "pending" || !leaving) {
    return (
      <Message
        title="This invite has closed"
        body="The team changed, the draw started, or the request was withdrawn. Nothing else is needed from you."
        slug={slug}
      />
    );
  }

  const partner = team.rows.find((r) => r.id !== leaving.id) ?? null;
  const paid = team.paymentStatus === "paid";
  const emailMismatch =
    user?.email && normalizePartnerEmail(user.email) !== normalizePartnerEmail(sub.substitute_email);
  const signupHref = `/signup?${new URLSearchParams({ substitute: token, next: self, email: sub.substitute_email })}`;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-16">
      <article className="grain relative animate-rise overflow-hidden rounded-3xl border border-umber bg-espresso">
        <div className="court-grid pointer-events-none absolute inset-0 opacity-30" />
        <div className="relative p-6 sm:p-10">
          <p className="eyebrow text-brass">Take their place</p>
          <h1 className="display mt-3 text-4xl text-bone text-balance sm:text-5xl">
            {leaving.name} asked you to play instead
          </h1>

          {/* the swap, visually */}
          <div className="mt-6 flex items-center gap-4 rounded-2xl border border-line bg-ink/40 p-4">
            <div className="flex flex-col items-center gap-1 opacity-50">
              <PlayerAvatar name={leaving.name} className="size-12 text-sm grayscale" />
              <span className="max-w-20 truncate text-[0.7rem] text-muted-foreground line-through">{leaving.name}</span>
            </div>
            <ArrowRight className="size-5 shrink-0 text-brass" />
            <div className="flex flex-col items-center gap-1">
              <PlayerAvatar name={sub.substitute_name} className="size-12 text-sm ring-brass" />
              <span className="max-w-20 truncate text-[0.7rem] text-bone">You</span>
            </div>
            {partner && (
              <>
                <span className="text-brass">&amp;</span>
                <div className="flex flex-col items-center gap-1">
                  <PlayerAvatar name={partner.name} className="size-12 text-sm" />
                  <span className="max-w-20 truncate text-[0.7rem] text-bone/80">{partner.name}</span>
                </div>
              </>
            )}
          </div>

          <div className="mt-4 rounded-2xl border border-line bg-ink/40 p-4 sm:p-5">
            <p className="text-lg font-semibold text-bone">{team.event.categoryName}</p>
            <p className="text-bone/80">{team.event.tournamentName}</p>
            <div className="mt-3 flex flex-col gap-1.5 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-x-5">
              <span className="flex items-center gap-1.5">
                <CalendarDays className="size-3.5" />
                {formatDateRange(team.event.startDate, team.event.endDate)}
              </span>
              {team.event.venue && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-3.5" />
                  {team.event.venue}
                </span>
              )}
            </div>
            <div className="mt-4 flex items-center gap-2 border-t border-line pt-4 text-sm">
              {paid ? (
                <>
                  <CheckCircle2 className="size-4 text-brass" />
                  <span className="text-bone">Entry fee already paid — nothing to pay.</span>
                </>
              ) : (
                <>
                  <Clock className="size-4 text-brass" />
                  <span className="text-bone">Entry fee not paid yet — the team captain handles it.</span>
                </>
              )}
            </div>
          </div>

          <p className="mt-6 text-sm text-muted-foreground">
            {leaving.name} stays on the team until you accept. Once you do, you&apos;re in their place right away.
          </p>

          <div className="mt-6">
            {user ? (
              <div className="space-y-3">
                {emailMismatch && (
                  <p className="text-xs text-muted-foreground">
                    Sent to {sub.substitute_email} — you&apos;re signed in as {user.email}. You can still accept here.
                  </p>
                )}
                <InviteActions
                  acceptLabel="Accept — join the team"
                  copy={{
                    decline: "I can't",
                    confirmDecline: "Can't play? We'll let them know so they can ask someone else.",
                    confirmDeclineButton: "Yes, decline",
                    declined: "Thanks — we've let them know.",
                    accepted: "You're in! Opening your entries…",
                  }}
                  accept={acceptSubstituteAction.bind(null, token)}
                  decline={declineSubstituteAction.bind(null, token)}
                />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <Button size="lg" asChild>
                    <Link href={signupHref}>
                      <UserPlus />
                      Create free account to accept
                    </Link>
                  </Button>
                  <Button size="lg" variant="outline" asChild>
                    <Link href={`/login?next=${encodeURIComponent(self)}`}>
                      <LogIn />I have an account
                    </Link>
                  </Button>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                  <Link href={`/tournaments/${slug}#entries`} className="text-sm text-bone underline-offset-4 hover:underline">
                    View the tournament →
                  </Link>
                  <InviteActions
                    declineOnly
                    copy={{
                      decline: "I can't",
                      confirmDecline: "Can't play? We'll let them know so they can ask someone else.",
                      confirmDeclineButton: "Yes, decline",
                      declined: "Thanks — we've let them know.",
                      accepted: "You're in! Opening your entries…",
                    }}
                    accept={acceptSubstituteAction.bind(null, token)}
                    decline={declineSubstituteAction.bind(null, token)}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </article>
    </div>
  );
}
