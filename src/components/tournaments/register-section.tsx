"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, CreditCard, Loader2, Lock, Swords, Ticket, UserRound } from "lucide-react";
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
};

export function RegisterSection({
  slug,
  divisions,
  currency = "PHP",
  defaultFeeCents = 0,
  allowPayAtVenue = false,
}: {
  slug: string;
  divisions: Division[];
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
  const venue = allowPayAtVenue && fee > 0 && payment === "venue";
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
                <span className="font-mono text-sm text-bone/80">
                  {formatPhp(d.entry_fee_cents ?? defaultFeeCents, currency)}
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

      {allowPayAtVenue && fee > 0 && (
        <fieldset>
          <legend className="eyebrow mb-3">How will you pay?</legend>
          <div className="grid grid-cols-2 gap-2" role="radiogroup">
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
                aria-checked={payment === value}
                onClick={() => setPayment(value)}
                className={cn(
                  "rounded-xl border px-3 py-3 text-left transition-all",
                  payment === value ? "border-bone bg-bone/[0.06]" : "border-line hover:border-bone/30"
                )}
              >
                <span className="block text-sm font-medium text-bone">{label}</span>
                <span className="block text-xs text-muted-foreground">{hint}</span>
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <div className="rounded-xl border border-line bg-ink/40 p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{venue ? "Pay at the desk" : "Total due"}</span>
          <span className="display text-3xl text-bone">{formatPhp(fee, currency)}</span>
        </div>
        <Button
          size="lg"
          className="mt-4 w-full"
          onClick={handleRegister}
          disabled={
            loading ||
            enablingPlayer ||
            !divisionId ||
            Boolean(entryForDivision) ||
            (isDoubles && !partnerName.trim())
          }
        >
          {loading ? (
            <>
              <Loader2 className="animate-spin" />
              {venue ? "Reserving your slot…" : "Preparing checkout…"}
            </>
          ) : venue ? (
            "Reserve my slot"
          ) : fee > 0 ? (
            "Continue to payment"
          ) : (
            "Confirm registration"
          )}
        </Button>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          {venue ? (
            "Your slot is held. You're confirmed once you pay at the desk."
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
