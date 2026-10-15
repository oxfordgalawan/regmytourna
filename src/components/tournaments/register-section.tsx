"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock, CreditCard, Info, Loader2, Lock, Swords, Ticket, UserRound } from "lucide-react";
import { toast } from "sonner";
import {
  cancelMyRegistrationAction,
  createRegistrationAction,
  listMyRegistrationsForTournamentAction,
  previewPartnerConflictAction,
} from "@/app/actions/registrations";
import Link from "next/link";
import { enableRoleAction, needsPlayerRoleForRegistrationAction } from "@/app/actions/role";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatPhp } from "@/lib/format";
import { cn } from "@/lib/utils";

type Division = {
  id: string;
  name: string;
  format: string;
  entry_fee_cents?: number | null;
  capacity?: number | null;
  /** entries currently holding a slot */
  taken?: number;
};

function isFull(d: Division | undefined) {
  return Boolean(d?.capacity && (d.taken ?? 0) >= d.capacity);
}

export function RegisterSection({
  slug,
  divisions,
  currency = "PHP",
  defaultFeeCents = 0,
  allowPayAtVenue = false,
  waitlistEnabled = false,
}: {
  slug: string;
  divisions: Division[];
  /** full categories take waitlist entries (no payment until a slot opens) */
  waitlistEnabled?: boolean;
  /** tournament lets players pay in cash / QR on the day */
  allowPayAtVenue?: boolean;
  currency?: string;
  defaultFeeCents?: number;
}) {
  const router = useRouter();
  const [divisionId, setDivisionId] = useState(divisions[0]?.id ?? "");
  const [partnerName, setPartnerName] = useState("");
  const [partnerEmail, setPartnerEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [partnerWarnings, setPartnerWarnings] = useState<string[]>([]);
  const [myEntries, setMyEntries] = useState<
    Awaited<ReturnType<typeof listMyRegistrationsForTournamentAction>>["entries"]
  >([]);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [needsPlayerRole, setNeedsPlayerRole] = useState(false);
  const [playerRoleReady, setPlayerRoleReady] = useState(false);
  const [playerGateOpen, setPlayerGateOpen] = useState(false);
  const [enablingPlayer, startEnablePlayer] = useTransition();

  useEffect(() => {
    void listMyRegistrationsForTournamentAction(slug).then((res) => setMyEntries(res.entries ?? []));
    void needsPlayerRoleForRegistrationAction().then((res) => {
      const needs = res.needsPlayerRole ?? false;
      setNeedsPlayerRole(needs);
      if (!needs) setPlayerRoleReady(true);
    });
  }, [slug]);

  const selected = divisions.find((d) => d.id === divisionId);
  const fee = selected?.entry_fee_cents ?? defaultFeeCents;
  const [payment, setPayment] = useState<"online" | "venue">("online");
  const full = isFull(selected);
  const waitlist = full && waitlistEnabled;
  const closed = full && !waitlistEnabled;
  const venue = !waitlist && allowPayAtVenue && fee > 0 && payment === "venue";
  const isDoubles = selected?.format === "doubles";

  const runPartnerPreview = useCallback(async () => {
    if (!isDoubles || !partnerEmail.trim() || !divisionId) {
      setPartnerWarnings([]);
      return;
    }
    const res = await previewPartnerConflictAction({
      tournamentSlug: slug,
      divisionId,
      partnerEmail: partnerEmail.trim(),
    });
    if ("error" in res && res.error) return;
    if ("blocked" in res && res.blocked) {
      setError(res.blocked);
      setPartnerWarnings([]);
      return;
    }
    setError(null);
    setPartnerWarnings("warnings" in res ? (res.warnings ?? []) : []);
  }, [slug, divisionId, partnerEmail, isDoubles]);

  useEffect(() => {
    const t = setTimeout(runPartnerPreview, 400);
    return () => clearTimeout(t);
  }, [runPartnerPreview]);

  async function submitRegistration() {
    setLoading(true);
    setError(null);
    setMessage(null);
    const result = await createRegistrationAction({
      tournamentSlug: slug,
      divisionId,
      partnerName: isDoubles ? partnerName.trim() : undefined,
      partnerEmail: isDoubles && partnerEmail.trim() ? partnerEmail.trim() : undefined,
      payAtVenue: venue,
    });
    if ("error" in result && result.error) {
      setLoading(false);
      setError(typeof result.error === "string" ? result.error : "Registration failed");
      return;
    }
    if ("warnings" in result && Array.isArray(result.warnings) && result.warnings.length) {
      setPartnerWarnings(result.warnings);
    }
    if ("waitlisted" in result && result.waitlisted && "registrationId" in result) {
      const pos = "position" in result && result.position ? result.position : 1;
      router.push(`/tournaments/${slug}/register/success?registration=${result.registrationId}&waitlist=${pos}`);
      return;
    }
    if ("checkoutUrl" in result && result.checkoutUrl) {
      window.location.href = result.checkoutUrl;
      return;
    }
    if ("payAtVenue" in result && result.payAtVenue && "registrationId" in result) {
      router.push(`/tournaments/${slug}/register/success?registration=${result.registrationId}&venue=1`);
      return;
    }
    setLoading(false);
    if ("message" in result && result.message) setMessage(result.message);
    if ("confirmed" in result && result.confirmed && "registrationId" in result) {
      router.push(`/tournaments/${slug}/register/success?registration=${result.registrationId}`);
    }
    void listMyRegistrationsForTournamentAction(slug).then((res) => setMyEntries(res.entries ?? []));
  }

  async function handleRegister() {
    if (!divisionId) return;
    if (isDoubles && !partnerName.trim()) {
      setError("Partner's full name is required for doubles.");
      return;
    }
    if (needsPlayerRole && !playerRoleReady) {
      setPlayerGateOpen(true);
      return;
    }
    await submitRegistration();
  }

  function confirmBecomePlayer() {
    startEnablePlayer(async () => {
      const res = await enableRoleAction("player");
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setNeedsPlayerRole(false);
      setPlayerRoleReady(true);
      setPlayerGateOpen(false);
      toast.success("Player access enabled — finishing your registration…");
      await submitRegistration();
    });
  }

  async function cancelEntry(registrationId: string) {
    setCancellingId(registrationId);
    const res = await cancelMyRegistrationAction(registrationId);
    setCancellingId(null);
    if ("error" in res && res.error) {
      setError(res.error);
      return;
    }
    setError(null);
    const next = await listMyRegistrationsForTournamentAction(slug);
    setMyEntries(next.entries ?? []);
  }

  const entryForDivision = myEntries.find((e) => e.divisionId === divisionId);

  if (!divisions.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Categories haven&apos;t been set up yet — registration will open once they are.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {partnerWarnings.length > 0 && !error && (
        <Alert>
          <AlertDescription>
            <ul className="list-inside list-disc space-y-1">
              {partnerWarnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">You can still register in this category.</p>
          </AlertDescription>
        </Alert>
      )}
      {message && (
        <Alert>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      {myEntries.length > 0 && (
        <Alert>
          <AlertDescription className="space-y-2">
            <p className="font-medium text-bone">Your entries for this event</p>
            <ul className="space-y-2 text-sm">
              {myEntries.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-surface px-3 py-2">
                  <span>
                    <span className="text-bone">{e.divisionName}</span>
                    <span className="ml-2 text-xs capitalize text-muted-foreground">
                      {e.status.replace(/_/g, " ")}
                      {e.paymentStatus === "pending" ? " · unpaid" : ""}
                    </span>
                  </span>
                  <span className="flex gap-2">
                    <Button type="button" size="xs" variant="outline" asChild>
                      <Link href="/entries">My entries</Link>
                    </Button>
                    {e.paymentStatus !== "paid" && (
                      <Button
                        type="button"
                        size="xs"
                        variant="ghost"
                        disabled={cancellingId === e.id}
                        onClick={() => cancelEntry(e.id)}
                      >
                        {cancellingId === e.id ? "Cancelling…" : "Cancel"}
                      </Button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {entryForDivision && (
        <Alert variant="destructive">
          <AlertDescription>
            You already have an entry in this category. Use <Link href="/entries" className="underline">My entries</Link> to
            pay or cancel it before registering again.
          </AlertDescription>
        </Alert>
      )}

      <fieldset>
        <legend className="eyebrow mb-3">1 · Choose a category</legend>
        <div className="grid gap-2" role="radiogroup">
          {divisions.map((d) => {
            const active = d.id === divisionId;
            return (
              <button
                key={d.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setDivisionId(d.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all",
                  active
                    ? "border-bone bg-bone/[0.06]"
                    : "border-line hover:border-bone/30 hover:bg-ink/30"
                )}
              >
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                    active ? "border-bone bg-bone text-ink" : "border-bone/30"
                  )}
                >
                  {active && <Check className="size-3" strokeWidth={3} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-bone">{d.name}</span>
                  <span className="block text-xs text-muted-foreground capitalize">{d.format}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className="font-mono text-sm text-bone/80">
                    {formatPhp(d.entry_fee_cents ?? defaultFeeCents, currency)}
                  </span>
                  {isFull(d) ? (
                    <span className="rounded-full border border-brass/40 px-2 text-[0.65rem] leading-5 text-brass">
                      {waitlistEnabled ? "Full · waitlist" : "Full"}
                    </span>
                  ) : d.capacity && d.capacity - (d.taken ?? 0) <= 3 ? (
                    <span className="text-[0.65rem] text-brass">
                      {d.capacity - (d.taken ?? 0)} {d.capacity - (d.taken ?? 0) === 1 ? "spot" : "spots"} left
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {isDoubles && (
        <fieldset className="space-y-4 animate-in fade-in-0 slide-in-from-top-1">
          <legend className="eyebrow mb-1">2 · Partner details</legend>
          <div className="space-y-2">
            <Label htmlFor="partner-name" className="text-sm font-medium text-bone">
              Partner&apos;s full name
            </Label>
            <Input
              id="partner-name"
              value={partnerName}
              onChange={(e) => setPartnerName(e.target.value)}
              placeholder="Partner's full name"
              autoComplete="name"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="partner-email" className="eyebrow">
              Partner&apos;s email <span className="normal-case tracking-normal">(optional)</span>
            </Label>
            <Input
              id="partner-email"
              type="email"
              value={partnerEmail}
              onChange={(e) => setPartnerEmail(e.target.value)}
              onBlur={() => runPartnerPreview()}
              placeholder="partner@email.com"
            />
            <p className="text-xs text-muted-foreground">
              We use their name on the draw. If you add an email, we&apos;ll notify them after your
              registration is complete.
            </p>
          </div>
        </fieldset>
      )}

      {allowPayAtVenue && fee > 0 && !closed && (
        <fieldset disabled={waitlist} aria-disabled={waitlist}>
          <legend className="eyebrow mb-3">How will you pay?</legend>
          <div className={cn("grid grid-cols-2 gap-2", waitlist && "pointer-events-none opacity-40")} role="radiogroup">
            {(
              [
                ["online", "Pay online now", "GCash, Maya or card"],
                ["venue", "Pay at the venue", "Cash or QR on the day"],
              ] as const
            ).map(([value, label, hint]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={!waitlist && payment === value}
                onClick={() => setPayment(value)}
                className={cn(
                  "rounded-xl border px-3 py-3 text-left transition-all",
                  !waitlist && payment === value ? "border-bone bg-bone/[0.06]" : "border-line hover:border-bone/30"
                )}
              >
                <span className="block text-sm font-medium text-bone">{label}</span>
                <span className="block text-xs text-muted-foreground">{hint}</span>
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {waitlist && (
        <div className="flex gap-3 rounded-xl border border-brass/40 bg-brass/[0.06] p-4 text-sm animate-in fade-in-0">
          <Clock className="mt-0.5 size-4 shrink-0 text-brass" aria-hidden />
          <div className="space-y-1">
            <p className="font-medium text-bone">This category is full — join the waitlist</p>
            <p className="text-bone/70">
              No payment now. If a slot opens, we&apos;ll move you in automatically and email you to choose
              {allowPayAtVenue ? " pay online or pay at the venue" : " how to pay"}. Payment is only collected once
              you&apos;re in a slot.
            </p>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-line bg-ink/40 p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {waitlist ? "Due now" : venue ? "Pay at the desk" : "Total due"}
          </span>
          <span className="display text-3xl text-bone">{formatPhp(waitlist ? 0 : fee, currency)}</span>
        </div>
        {waitlist && fee > 0 && (
          <p className="mt-1 text-right text-xs text-muted-foreground">
            {formatPhp(fee, currency)} once you&apos;re moved into a slot
          </p>
        )}
        {!waitlist && !closed && fee > 0 && (
          <p className="mt-3 flex gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-xs leading-relaxed text-bone/75">
            <Info className="mt-0.5 size-3.5 shrink-0 text-brass" aria-hidden />
            <span>
              <span className="font-semibold text-bone">Entry fees are non-refundable.</span> Make sure you and your
              partner can play on the event dates before paying.
            </span>
          </p>
        )}
        <Button
          size="lg"
          className="mt-4 w-full"
          onClick={handleRegister}
          disabled={
            loading ||
            enablingPlayer ||
            closed ||
            !divisionId ||
            Boolean(entryForDivision) ||
            (isDoubles && !partnerName.trim())
          }
        >
          {loading ? (
            <>
              <Loader2 className="animate-spin" />
              {waitlist ? "Saving your place…" : venue ? "Reserving your slot…" : "Preparing checkout…"}
            </>
          ) : closed ? (
            "Category full"
          ) : waitlist ? (
            "Join the waitlist"
          ) : venue ? (
            "Reserve my slot"
          ) : fee > 0 ? (
            "Continue to payment"
          ) : (
            "Confirm registration"
          )}
        </Button>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          {closed ? (
            "No slots left in this category. Try another one."
          ) : waitlist ? (
            "You'll get an email the moment a slot opens."
          ) : venue ? (
            "Your slot is held. You're confirmed once you pay at the desk."
          ) : fee <= 0 ? (
            "Free entry — you're confirmed right away."
          ) : (
            <>
              <Lock className="size-3" aria-hidden />
              Secure checkout by PayMongo
            </>
          )}
        </p>
      </div>

      <Dialog open={playerGateOpen} onOpenChange={setPlayerGateOpen}>
        <DialogContent className="border-line bg-ink sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="display text-2xl text-bone">Become a player too?</DialogTitle>
            <DialogDescription className="text-left text-sm leading-relaxed text-muted-foreground">
              You&apos;re signed in as an organizer. To enter this tournament you also need player
              access — your organizer tools stay exactly as they are.
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-3 text-sm text-bone/90">
            {(
              [
                [Ticket, "Join tournaments in a couple of taps"],
                [Swords, "Track your entries, matches and results"],
                [CreditCard, "Pay online or at the venue"],
              ] as const
            ).map(([Icon, text]) => (
              <li key={text} className="flex items-start gap-3">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-bone/10">
                  <Icon className="size-4 text-bone" aria-hidden />
                </span>
                {text}
              </li>
            ))}
          </ul>
          <DialogFooter className="gap-2 sm:flex-col sm:space-x-0">
            <Button
              size="lg"
              className="w-full"
              onClick={confirmBecomePlayer}
              disabled={enablingPlayer}
            >
              {enablingPlayer ? (
                <>
                  <Loader2 className="animate-spin" />
                  Enabling player access…
                </>
              ) : (
                <>
                  <UserRound className="size-4" aria-hidden />
                  Yes, become a player
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={() => setPlayerGateOpen(false)}
              disabled={enablingPlayer}
            >
              Not now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
