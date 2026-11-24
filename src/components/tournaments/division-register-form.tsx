"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Clock, Info, Loader2, Lock, UserRound } from "lucide-react";
import { toast } from "@/lib/ui/app-toast";
import {
  createRegistrationAction,
  previewCrossCategoryEligibilityAction,
  previewPartnerConflictAction,
} from "@/app/actions/registrations";
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
import { showError } from "@/lib/ui/error-dialog";

export type DivisionRegisterComplete =
  | {
      kind: "pay";
      registrationId: string;
      qrImageUrl: string;
      checkoutUrl?: string | null;
      qrExpiresAt?: string | null;
      amountCents: number;
      paymentHoldExpiresAt?: string | null;
    }
  | { kind: "waitlist"; registrationId: string; position?: number | null }
  | { kind: "venue"; registrationId: string }
  | { kind: "confirmed"; registrationId: string }
  | { kind: "payment_required"; registrationId: string; message: string };

function isFull(capacity: number | null | undefined, taken: number) {
  return Boolean(capacity && taken >= capacity);
}

export function DivisionRegisterForm({
  slug,
  divisionId,
  divisionName,
  format,
  feeCents,
  currency = "PHP",
  waitlistEnabled,
  allowPayAtVenue,
  capacity,
  taken = 0,
  blockNewRegistration,
  crossCategoryBlock,
  onComplete,
}: {
  slug: string;
  divisionId: string;
  divisionName: string;
  format: string;
  feeCents: number;
  currency?: string;
  waitlistEnabled: boolean;
  allowPayAtVenue: boolean;
  capacity?: number | null;
  taken?: number;
  blockNewRegistration?: boolean;
  crossCategoryBlock?: string | null;
  onComplete: (result: DivisionRegisterComplete) => void;
}) {
  const [partnerName, setPartnerName] = useState("");
  const [partnerEmail, setPartnerEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [partnerWarnings, setPartnerWarnings] = useState<string[]>([]);
  const [needsPlayerRole, setNeedsPlayerRole] = useState(false);
  const [playerRoleReady, setPlayerRoleReady] = useState(false);
  const [playerGateOpen, setPlayerGateOpen] = useState(false);
  const [enablingPlayer, startEnablePlayer] = useTransition();
  const [payment, setPayment] = useState<"online" | "venue">("online");

  useEffect(() => {
    void needsPlayerRoleForRegistrationAction().then((res) => {
      const needs = res.needsPlayerRole ?? false;
      setNeedsPlayerRole(needs);
      if (!needs) setPlayerRoleReady(true);
    });
  }, []);

  const full = isFull(capacity, taken);
  const waitlist = full && waitlistEnabled;
  const closed = full && !waitlistEnabled;
  const venue = !waitlist && allowPayAtVenue && feeCents > 0 && payment === "venue";
  const isDoubles = format === "doubles";

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
      showError(res.blocked, { title: "Couldn't register" });
      setPartnerWarnings([]);
      return;
    }
    setPartnerWarnings("warnings" in res ? (res.warnings ?? []) : []);
  }, [slug, divisionId, partnerEmail, isDoubles]);

  useEffect(() => {
    const t = setTimeout(runPartnerPreview, 400);
    return () => clearTimeout(t);
  }, [runPartnerPreview]);

  async function submitRegistration() {
    setLoading(true);
    const result = await createRegistrationAction({
      tournamentSlug: slug,
      divisionId,
      partnerName: isDoubles ? partnerName.trim() : undefined,
      partnerEmail: isDoubles && partnerEmail.trim() ? partnerEmail.trim() : undefined,
      payAtVenue: venue,
    });
    setLoading(false);

    if ("error" in result && result.error) {
      const existingId =
        "existingRegistrationId" in result && typeof result.existingRegistrationId === "string"
          ? result.existingRegistrationId
          : null;
      if (existingId) {
        onComplete({ kind: "pay", registrationId: existingId, qrImageUrl: "", amountCents: feeCents });
        return;
      }
      showError(typeof result.error === "string" ? result.error : "Registration failed", {
        title: "Couldn't register",
      });
      return;
    }

    if ("warnings" in result && Array.isArray(result.warnings) && result.warnings.length) {
      setPartnerWarnings(result.warnings);
    }

    const registrationId = "registrationId" in result && result.registrationId ? result.registrationId : "";

    if ("waitlisted" in result && result.waitlisted && registrationId) {
      const position = "position" in result ? (result.position as number | null | undefined) : null;
      onComplete({ kind: "waitlist", registrationId, position });
      return;
    }
    if ("payAtVenue" in result && result.payAtVenue && registrationId) {
      onComplete({ kind: "venue", registrationId });
      return;
    }
    const qrImageUrl =
      "qrImageUrl" in result && typeof result.qrImageUrl === "string" ? result.qrImageUrl : "";
    if (registrationId && qrImageUrl) {
      onComplete({
        kind: "pay",
        registrationId,
        qrImageUrl,
        checkoutUrl: "checkoutUrl" in result ? (result.checkoutUrl as string | null) : null,
        qrExpiresAt:
          "expiresAt" in result && typeof result.expiresAt === "string" ? result.expiresAt : null,
        amountCents: feeCents,
        paymentHoldExpiresAt:
          "paymentHoldExpiresAt" in result && typeof result.paymentHoldExpiresAt === "string"
            ? result.paymentHoldExpiresAt
            : null,
      });
      return;
    }
    if ("paymentRequired" in result && result.paymentRequired && registrationId) {
      onComplete({
        kind: "payment_required",
        registrationId,
        message: typeof result.message === "string" ? result.message : "Payment is not available.",
      });
      return;
    }
    if ("confirmed" in result && result.confirmed && registrationId) {
      onComplete({ kind: "confirmed", registrationId });
    }
  }

  async function handleRegister() {
    if (isDoubles && !partnerName.trim()) {
      showError("Partner's full name is required for doubles.", { title: "Couldn't register" });
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

  if (blockNewRegistration) {
    return (
      <p className="text-sm text-muted-foreground">You already have an entry in this category — complete payment below.</p>
    );
  }

  if (crossCategoryBlock) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{crossCategoryBlock}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="eyebrow text-brass">Submit entry</p>
        <p className="mt-1 font-medium text-bone">{divisionName}</p>
        <p className="text-sm capitalize text-muted-foreground">{format}</p>
      </div>

      {partnerWarnings.length > 0 && (
        <Alert>
          <AlertDescription>
            <ul className="list-inside list-disc space-y-1">
              {partnerWarnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {isDoubles && (
        <fieldset className="space-y-4">
          <legend className="eyebrow mb-1">Partner details</legend>
          <div className="space-y-2">
            <Label htmlFor="drawer-partner-name" className="text-sm font-medium text-bone">
              Partner&apos;s full name
            </Label>
            <Input
              id="drawer-partner-name"
              value={partnerName}
              onChange={(e) => setPartnerName(e.target.value)}
              placeholder="Partner's full name"
              autoComplete="name"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="drawer-partner-email" className="eyebrow">
              Partner&apos;s email <span className="normal-case tracking-normal">(optional)</span>
            </Label>
            <Input
              id="drawer-partner-email"
              type="email"
              value={partnerEmail}
              onChange={(e) => setPartnerEmail(e.target.value)}
              onBlur={() => runPartnerPreview()}
              placeholder="partner@email.com"
            />
          </div>
        </fieldset>
      )}

      {allowPayAtVenue && feeCents > 0 && !closed && (
        <fieldset disabled={waitlist} aria-disabled={waitlist}>
          <legend className="eyebrow mb-3">How will you pay?</legend>
          <div className={cn("grid grid-cols-2 gap-2", waitlist && "pointer-events-none opacity-40")} role="radiogroup">
            {(
              [
                ["online", "Pay online now", "QR, card or browser"],
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
        <div className="flex gap-3 rounded-xl border border-brass/40 bg-brass/[0.06] p-4 text-sm">
          <Clock className="mt-0.5 size-4 shrink-0 text-brass" aria-hidden />
          <p className="text-bone/70">
            Category full — join the waitlist. No payment until a slot opens.
          </p>
        </div>
      )}

      <div className="rounded-xl border border-line bg-ink/40 p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{waitlist ? "Due now" : venue ? "Pay at the desk" : "Total due"}</span>
          <span className="display text-3xl text-bone">{formatPhp(waitlist ? 0 : feeCents, currency)}</span>
        </div>
        {!waitlist && !closed && feeCents > 0 && (
          <p className="mt-3 flex gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-xs leading-relaxed text-bone/75">
            <Info className="mt-0.5 size-3.5 shrink-0 text-brass" aria-hidden />
            Entry fees are non-refundable.
          </p>
        )}
        <Button
          size="lg"
          className="mt-4 w-full"
          onClick={handleRegister}
          disabled={
            loading || enablingPlayer || closed || Boolean(crossCategoryBlock) || (isDoubles && !partnerName.trim())
          }
        >
          {loading ? (
            <>
              <Loader2 className="animate-spin" />
              {waitlist ? "Saving your place…" : venue ? "Reserving your slot…" : "Submitting…"}
            </>
          ) : closed ? (
            "Category full"
          ) : waitlist ? (
            "Join the waitlist"
          ) : venue ? (
            "Reserve my slot"
          ) : feeCents > 0 ? (
            "Submit entry"
          ) : (
            "Confirm registration"
          )}
        </Button>
        {!waitlist && feeCents > 0 && !venue && (
          <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="size-3" aria-hidden />
            Secure checkout by PayMongo
          </p>
        )}
      </div>

      <Dialog open={playerGateOpen} onOpenChange={setPlayerGateOpen}>
        <DialogContent className="border-line bg-ink sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="display text-2xl text-bone">Become a player too?</DialogTitle>
            <DialogDescription className="text-left text-sm leading-relaxed text-muted-foreground">
              You&apos;re signed in as an organizer. To enter this tournament you also need player access.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:flex-col sm:space-x-0">
            <Button size="lg" className="w-full" onClick={confirmBecomePlayer} disabled={enablingPlayer}>
              {enablingPlayer ? (
                <>
                  <Loader2 className="animate-spin" />
                  Enabling…
                </>
              ) : (
                <>
                  <UserRound className="size-4" />
                  Yes, become a player
                </>
              )}
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={() => setPlayerGateOpen(false)}>
              Not now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}