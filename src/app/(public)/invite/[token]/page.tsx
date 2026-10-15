import Link from "next/link";
import { ArrowRight, CalendarDays, CheckCircle2, Clock, LogIn, MapPin, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InviteActions } from "@/components/invites/invite-actions";
import { acceptPartnerInviteAction, declinePartnerInviteAction } from "@/app/actions/partner-invites";
import { findInviteByToken } from "@/lib/registrations/partner-invites";
import { getOptionalUser } from "@/lib/auth/require-user";
import { normalizePartnerEmail } from "@/lib/registrations/partner-conflicts";
import { formatDateRange } from "@/lib/format";
import { NAV_FORWARD } from "@/lib/nav-transitions";

export const metadata = { title: "Partner invite", robots: { index: false } };

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

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [invite, user] = await Promise.all([findInviteByToken(token), getOptionalUser()]);

  if (!invite) {
    return (
      <Message
        title="This link has expired"
        body="The invite may have been replaced — your partner might have updated their entry. Ask them to resend it."
      />
    );
  }

  const t = invite.tournament;
  const self = `/invite/${token}`;
  const mine = Boolean(user && invite.linkedUserId === user.id);
  const takenByOther = Boolean(invite.linkedUserId && !mine);
  const paid = invite.paymentStatus === "paid";
  const emailMismatch =
    user?.email && invite.partnerEmail && normalizePartnerEmail(user.email) !== normalizePartnerEmail(invite.partnerEmail);

  if (invite.status === "declined") {
    return (
      <Message
        title="You said this wasn't you"
        body={`We let ${invite.registrantName} know. If that was a mistake, ask them to add you again.`}
        slug={t.slug}
      />
    );
  }
  if (takenByOther) {
    return (
      <Message
        title="Already accepted"
        body="This invite was accepted by another account. If that wasn't you, contact the organizer."
        slug={t.slug}
      />
    );
  }

  const signupHref = `/signup?${new URLSearchParams({
    invite: token,
    next: self,
    ...(invite.partnerEmail ? { email: invite.partnerEmail } : {}),
  })}`;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-16">
      <article className="grain relative animate-rise overflow-hidden rounded-3xl border border-umber bg-espresso">
        {t.coverImageUrl && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={t.coverImageUrl} alt="" className="absolute inset-0 size-full object-cover opacity-25" />
            <div className="absolute inset-0 bg-gradient-to-b from-espresso/60 via-espresso/90 to-espresso" />
          </>
        )}
        <div className="court-grid pointer-events-none absolute inset-0 opacity-30" />

        <div className="relative p-6 sm:p-10">
          <p className="eyebrow text-brass">{mine ? "Your entry" : "Partner invite"}</p>
          <h1 className="display mt-3 text-4xl text-bone text-balance sm:text-5xl">
            {mine ? "You're on the team." : `${invite.registrantName} added you as partner`}
          </h1>

          <div className="mt-6 rounded-2xl border border-line bg-ink/40 p-4 backdrop-blur sm:p-5">
            <p className="text-lg font-semibold text-bone">{invite.categoryName}</p>
            <p className="text-bone/80">{t.name}</p>
            <div className="mt-3 flex flex-col gap-1.5 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-x-5">
              <span className="flex items-center gap-1.5">
                <CalendarDays className="size-3.5" />
                {formatDateRange(t.startDate, t.endDate)}
              </span>
              {(t.venueName || t.city) && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-3.5" />
                  {[t.venueName, t.city].filter(Boolean).join(", ")}
                </span>
              )}
            </div>
            <div className="mt-4 flex items-center gap-2 border-t border-line pt-4 text-sm">
              {paid ? (
                <>
                  <CheckCircle2 className="size-4 text-brass" />
                  <span className="text-bone">Entry paid by {invite.registrantName} — you&apos;re in the draw.</span>
                </>
              ) : (
                <>
                  <Clock className="size-4 text-brass" />
                  <span className="text-bone">Payment pending — {invite.registrantName} is handling it.</span>
                </>
              )}
            </div>
          </div>

          <p className="mt-6 text-sm text-muted-foreground">
            {mine
              ? "This entry is in your account. Follow your matches and results there, and file a petition if you need to."
              : "Nothing else is needed for you to play. Add it to your account to see your matches and results, and to file a petition if you need to."}
          </p>

          <div className="mt-6">
            {mine ? (
              <div className="flex flex-wrap gap-2">
                <Button size="lg" asChild>
                  <Link href="/entries" transitionTypes={NAV_FORWARD}>
                    Open my entries
                    <ArrowRight />
                  </Link>
                </Button>
                <Button size="lg" variant="ghost" asChild>
                  <Link href={`/tournaments/${t.slug}#entries`}>View tournament</Link>
                </Button>
              </div>
            ) : user ? (
              <div className="space-y-3">
                {emailMismatch && (
                  <p className="text-xs text-muted-foreground">
                    Sent to {invite.partnerEmail} — you&apos;re signed in as {user.email}. You can still accept it here.
                  </p>
                )}
                <InviteActions
                  accept={acceptPartnerInviteAction.bind(null, token)}
                  decline={declinePartnerInviteAction.bind(null, token)}
                />
              </div>
            ) : (
              <div className="space-y-4">
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
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                  <Link
                    href={`/tournaments/${t.slug}#entries`}
                    className="text-sm text-bone underline-offset-4 hover:underline"
                  >
                    Just view the tournament & entries →
                  </Link>
                  <InviteActions
                    declineOnly
                    accept={acceptPartnerInviteAction.bind(null, token)}
                    decline={declinePartnerInviteAction.bind(null, token)}
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

