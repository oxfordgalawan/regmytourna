"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDeferredValue, useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Clock, FileText, List, Loader2, Lock, Search, Ticket, Users } from "lucide-react";
import { RegistrationAuthPanel } from "@/components/auth/registration-auth-panel";
import { getMyPetitionEligibilityAction } from "@/app/actions/petitions";
import { getPublicDivisionRosterAction } from "@/app/actions/public-roster";
import {
  getMyRegistrationPaymentStatusAction,
  listMyRegistrationsForTournamentAction,
  previewCrossCategoryEligibilityAction,
} from "@/app/actions/registrations";
import {
  DivisionRegisterForm,
  type DivisionRegisterComplete,
} from "@/components/tournaments/division-register-form";
import { CheckoutQrPanel } from "@/components/payments/checkout-qr-panel";
import { DivisionSlotGrid } from "@/components/tournaments/division-slot-grid";
import { PaymentHoldTimer } from "@/components/tournaments/payment-hold-timer";
import { PetitionSubmitDialog } from "@/components/petitions/petition-submit-dialog";
import { PlayerAvatar } from "@/components/players/player-avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { entrantNoun } from "@/lib/categories";
import type { PublicRosterEntry } from "@/lib/registrations/public-roster";
import { cn } from "@/lib/utils";
import { showError } from "@/lib/ui/error-dialog";

type FlowStep = "roster" | "auth" | "register" | "pay" | "success";

type MyEntry = { id: string; paymentStatus: string; status: string };

type Eligibility = Awaited<ReturnType<typeof getMyPetitionEligibilityAction>>;
type Roster = Awaited<ReturnType<typeof getPublicDivisionRosterAction>>;

/** One entry as a card: stacked avatars, names, and their entry number. */
function TeamCard({
  entry,
  index,
  onHoldExpire,
}: {
  entry: PublicRosterEntry;
  index: number;
  onHoldExpire?: () => void;
}) {
  if (entry.paymentHold?.expiresAt) {
    return (
      <li
        className="flex min-h-[5.5rem] flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-line/80 bg-ink/25 p-4 text-center"
        style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}
      >
        <span className="font-mono text-xs text-brass">#{String(index + 1).padStart(2, "0")}</span>
        <span className="flex items-center gap-1.5 text-sm font-medium text-bone/85">
          <Clock className="size-3.5 text-brass" aria-hidden />
          Reserved
        </span>
        <span className="text-xs text-muted-foreground">
          Pay pending · <PaymentHoldTimer expiresAt={entry.paymentHold.expiresAt} onExpire={onHoldExpire} />
        </span>
      </li>
    );
  }
  const [a, b] = entry.players;
  return (
    <li
      className="group relative flex animate-rise items-center gap-4 overflow-hidden rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-umber"
      style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}
    >
      <span className="absolute top-3 right-4 font-mono text-[0.65rem] tracking-widest text-muted-foreground/70">
        {String(index + 1).padStart(2, "0")}
      </span>
      <div className="flex shrink-0 -space-x-3">
        <PlayerAvatar name={a.name} src={a.avatarUrl} className="size-12 text-base" />
        {b && (
          <PlayerAvatar
            name={b.name}
            src={b.avatarUrl}
            className="size-12 text-base transition-transform duration-300 group-hover:translate-x-1"
          />
        )}
      </div>
      <div className="min-w-0 pr-6">
        <p className="truncate font-semibold text-bone">{a.name}</p>
        {b && (
          <p className="truncate text-sm text-bone/75">
            <span className="text-brass">&amp;</span> {b.name}
          </p>
        )}
      </div>
    </li>
  );
}

function CardSkeleton() {
  return (
    <li className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4">
      <div className="flex -space-x-3">
        <span className="size-12 animate-pulse rounded-full bg-umber/40 ring-2 ring-espresso" />
        <span className="size-12 animate-pulse rounded-full bg-umber/30 ring-2 ring-espresso" />
      </div>
      <div className="flex-1 space-y-2">
        <span className="block h-3.5 w-3/5 animate-pulse rounded bg-umber/40" />
        <span className="block h-3 w-2/5 animate-pulse rounded bg-umber/25" />
      </div>
    </li>
  );
}

export function DivisionRosterButton({
  tournamentSlug,
  tournamentId,
  divisionId,
  format,
  registrationOpen = false,
  isSignedIn = false,
  waitlistEnabled = false,
  entryFeeCents,
  defaultFeeCents = 0,
  currency = "PHP",
  allowPayAtVenue = false,
  capacity = null,
  taken = 0,
}: {
  tournamentSlug: string;
  tournamentId: string;
  divisionId: string;
  format: string;
  registrationOpen?: boolean;
  isSignedIn?: boolean;
  waitlistEnabled?: boolean;
  entryFeeCents?: number | null;
  defaultFeeCents?: number;
  currency?: string;
  allowPayAtVenue?: boolean;
  capacity?: number | null;
  taken?: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const pendingRegisterAfterAuth = useRef(false);
  const [guestSignedIn, setGuestSignedIn] = useState(false);
  const [petitionOpen, setPetitionOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Roster | null>(null);
  const [eligibility, setEligibility] = useState<Eligibility | null>(null);
  const [myEntry, setMyEntry] = useState<MyEntry | null>(null);
  const [query, setQuery] = useState("");
  const [flowStep, setFlowStep] = useState<FlowStep>("roster");
  const [payState, setPayState] = useState<{
    registrationId: string;
    qrImageUrl: string;
    checkoutUrl?: string | null;
    amountCents: number;
    paymentHoldExpiresAt?: string | null;
    qrExpiresAt?: string | null;
  } | null>(null);
  const [payLoading, setPayLoading] = useState(false);
  const [crossCategoryBlock, setCrossCategoryBlock] = useState<string | null>(null);
  const [successKind, setSuccessKind] = useState<"waitlist" | "venue" | "free" | "paid" | null>(null);
  const [waitlistPos, setWaitlistPos] = useState<number | null>(null);
  const q = useDeferredValue(query.trim().toLowerCase());
  const feeCents = entryFeeCents ?? defaultFeeCents;

  async function load(assumeSignedIn = false) {
    setLoading(true);
    setError(null);
    const crossPreview =
      isSignedIn || guestSignedIn || assumeSignedIn
        ? previewCrossCategoryEligibilityAction({ tournamentSlug, divisionId })
        : Promise.resolve({ allowed: true as const, existing: [] as const });
    const [res, elig, cross] = await Promise.all([
      getPublicDivisionRosterAction(tournamentSlug, divisionId),
      getMyPetitionEligibilityAction(tournamentSlug, divisionId),
      crossPreview,
    ]);
    if ("allowed" in cross && !cross.allowed && "error" in cross && cross.error) {
      setCrossCategoryBlock(cross.error);
    } else {
      setCrossCategoryBlock(null);
    }
    if (isSignedIn || guestSignedIn || assumeSignedIn) {
      const mine = await listMyRegistrationsForTournamentAction(tournamentSlug);
      const e = mine.entries?.find((x) => x.divisionId === divisionId);
      setMyEntry(e ? { id: e.id, paymentStatus: e.paymentStatus, status: e.status } : null);
    } else {
      setMyEntry(null);
    }
    setLoading(false);
    if ("error" in res && res.error) {
      setError(res.error);
      setData(null);
    } else {
      setData(res);
    }
    setEligibility("error" in elig && elig.error ? null : elig);
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setQuery("");
      void load();
    } else {
      setFlowStep("roster");
      setPayState(null);
      setSuccessKind(null);
      setWaitlistPos(null);
      setGuestSignedIn(false);
      pendingRegisterAfterAuth.current = false;
    }
  }

  function refreshEligibility() {
    void getMyPetitionEligibilityAction(tournamentSlug, divisionId).then((elig) => {
      if (!("error" in elig && elig.error)) setEligibility(elig);
    });
  }

  const roster = data && !("error" in data) ? data : null;
  const elig = eligibility && !("error" in eligibility) ? eligibility : null;
  const noun = (n: number) => entrantNoun(format, n || 1);
  const matches = (e: PublicRosterEntry) =>
    !q || Boolean(e.paymentHold) || e.players.some((p) => p.name.toLowerCase().includes(q));
  const hasActiveHolds = Boolean(roster?.slots.some((s) => s.paymentHold?.expiresAt));

  useEffect(() => {
    if (!open || flowStep !== "roster" || !hasActiveHolds) return;
    const id = window.setInterval(() => void load(), 20_000);
    return () => window.clearInterval(id);
  }, [open, flowStep, hasActiveHolds]);
  const slots = roster?.slots.filter(matches) ?? [];
  const fill = roster?.capacity ? Math.min(100, (roster.taken / roster.capacity) * 100) : null;
  const sessionActive = isSignedIn || guestSignedIn;
  const slotCapacity = roster?.capacity ?? capacity ?? 0;
  const showSlotGrid = slotCapacity > 0;
  const categoryFull = Boolean(showSlotGrid && roster && roster.slots.length >= slotCapacity);
  const signedOut = !sessionActive;
  const alreadyEntered = Boolean(sessionActive && elig && elig.reason !== "not_registered");
  const invitePending = Boolean(elig?.reason === "invite_pending" && elig.inviteToken);
  const needsUnpaidPay = Boolean(
    myEntry &&
      myEntry.paymentStatus === "pending" &&
      myEntry.status !== "waitlisted" &&
      feeCents > 0
  );

  async function beginPayFlow(
    registrationId: string,
    knownQr?: { qrImageUrl: string; checkoutUrl?: string | null; qrExpiresAt?: string | null },
    amountCents = feeCents,
    paymentHoldExpiresAt?: string | null
  ) {
    setFlowStep("pay");
    setPayLoading(true);
    let qrImageUrl = knownQr?.qrImageUrl?.trim() || "";
    let checkoutUrl = knownQr?.checkoutUrl?.trim() || "";
    let qrExpiresAt = knownQr?.qrExpiresAt ?? null;
    let holdEnds = paymentHoldExpiresAt ?? null;
    if (!holdEnds && !allowPayAtVenue) {
      const status = await getMyRegistrationPaymentStatusAction(registrationId);
      if (!("error" in status) && status.paymentHoldExpiresAt) holdEnds = status.paymentHoldExpiresAt;
    }
    if (!qrImageUrl) {
      try {
        const res = await fetch("/api/payments/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ registrationId }),
        });
        const json = (await res.json()) as {
          qrImageUrl?: string;
          checkoutUrl?: string;
          expiresAt?: string;
          error?: string;
        };
        if (!res.ok || !json.qrImageUrl) throw new Error(json.error ?? "Couldn't start checkout");
        qrImageUrl = json.qrImageUrl;
        checkoutUrl = json.checkoutUrl ?? "";
        qrExpiresAt = json.expiresAt ?? null;
      } catch (e) {
        setPayLoading(false);
        setFlowStep("roster");
        showError(e instanceof Error ? e.message : "Couldn't start checkout", { title: "Payment" });
        return;
      }
    }
    setPayState({
      registrationId,
      qrImageUrl,
      checkoutUrl: checkoutUrl || null,
      amountCents,
      paymentHoldExpiresAt: holdEnds,
      qrExpiresAt,
    });
    setPayLoading(false);
  }

  async function handleRegisterComplete(result: DivisionRegisterComplete) {
    if (result.kind === "pay") {
      await beginPayFlow(
        result.registrationId,
        {
          qrImageUrl: result.qrImageUrl,
          checkoutUrl: result.checkoutUrl,
          qrExpiresAt: result.qrExpiresAt,
        },
        result.amountCents,
        result.paymentHoldExpiresAt
      );
      return;
    }
    if (result.kind === "payment_required") {
      showError(result.message, { title: "Payment" });
      return;
    }
    if (result.kind === "waitlist") {
      setSuccessKind("waitlist");
      setWaitlistPos(result.position ?? null);
      setFlowStep("success");
      void load();
      router.refresh();
      return;
    }
    if (result.kind === "venue") {
      setSuccessKind("venue");
      setFlowStep("success");
      void load();
      router.refresh();
      return;
    }
    if (result.kind === "confirmed") {
      setSuccessKind("free");
      setFlowStep("success");
      void load();
      router.refresh();
    }
  }

  function goBack() {
    if (flowStep === "auth") {
      setFlowStep("roster");
      pendingRegisterAfterAuth.current = false;
      return;
    }
    if (flowStep === "register") {
      setFlowStep("roster");
      return;
    }
    if (flowStep === "pay") {
      setPayState(null);
      setFlowStep("roster");
      return;
    }
    if (flowStep === "success") {
      setSuccessKind(null);
      setFlowStep("roster");
    }
  }

  function startRegistrationFlow() {
    if (!registrationOpen) {
      showError(
        "Registration isn't open yet. Check the open date on the event page, or ask the organizer to enable entries.",
        { title: "Registration not open" }
      );
      return;
    }
    if (categoryFull && !waitlistEnabled) {
      showError("This category is full — no more slots.", { title: "Category full" });
      return;
    }
    if (signedOut) {
      pendingRegisterAfterAuth.current = true;
      setFlowStep("auth");
      return;
    }
    if (invitePending && elig?.inviteToken) return;
    if (crossCategoryBlock) {
      showError(crossCategoryBlock, { title: "Can't register here" });
      return;
    }
    if (alreadyEntered) {
      const regId = elig?.registrationId ?? myEntry?.id;
      if (needsUnpaidPay && regId) {
        void beginPayFlow(regId);
        return;
      }
      if (myEntry?.paymentStatus === "paid") {
        setSuccessKind("paid");
        setFlowStep("success");
        return;
      }
    }
    setFlowStep("register");
  }

  function handleAuthenticated() {
    setGuestSignedIn(true);
    void load(true);
    if (pendingRegisterAfterAuth.current) {
      pendingRegisterAfterAuth.current = false;
      setFlowStep("register");
    } else {
      setFlowStep("roster");
    }
  }

  function openAuthForPetition() {
    pendingRegisterAfterAuth.current = false;
    setFlowStep("auth");
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(true)}>
        <List className="size-4" />
        Entries
      </Button>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={cn(
            "flex max-h-[90dvh] w-[calc(100%-1.5rem)] flex-col gap-0 overflow-hidden border border-umber bg-espresso p-0",
            flowStep === "roster" ? "sm:max-w-3xl" : "sm:max-w-lg"
          )}
        >
          {/* header */}
          <div className="grain relative shrink-0 overflow-hidden border-b border-line px-5 pt-6 pb-5 sm:px-8 sm:pt-8">
            <div className="court-grid pointer-events-none absolute inset-0 opacity-40" />
            <div className="relative">
              <p className="eyebrow text-brass">
                {flowStep === "auth"
                  ? "Sign in to continue"
                  : flowStep === "register"
                    ? "Submit entry"
                    : flowStep === "pay"
                      ? "Pay online"
                      : flowStep === "success"
                        ? "Confirmed"
                        : "Who's in"}
              </p>
              <DialogTitle className="display mt-2 pr-8 text-3xl text-bone sm:text-4xl">
                {roster?.divisionName ?? "Category entries"}
              </DialogTitle>
              <DialogDescription className="mt-1">
                {roster
                  ? roster.capacity
                    ? `${roster.taken} of ${roster.capacity} ${noun(roster.capacity)} · ${Math.max(0, roster.capacity - roster.taken)} spots left`
                    : `${roster.taken} ${noun(roster.taken)} entered`
                  : "Everyone who has entered this category."}
                {showSlotGrid && flowStep === "roster" && registrationOpen && !categoryFull && (
                  <span className="mt-1 block text-bone/70">
                    Tap an available slot to register and pay here.
                  </span>
                )}
                {showSlotGrid && flowStep === "roster" && !registrationOpen && (
                  <span className="mt-1 block text-bone/70">
                    Registration isn&apos;t open yet — slots shown for reference.
                  </span>
                )}
                {showSlotGrid &&
                  flowStep === "roster" &&
                  !allowPayAtVenue &&
                  roster?.onlinePaymentHoldMinutes &&
                  feeCents > 0 && (
                    <span className="mt-1 block text-bone/70">
                      Online payment only — unpaid slots release after {roster.onlinePaymentHoldMinutes} minutes.
                    </span>
                  )}
              </DialogDescription>
              {fill !== null && (
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-ink/60" aria-hidden>
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-umber to-brass transition-[width] duration-700 ease-out"
                    style={{ width: `${Math.max(fill, 2)}%` }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* body */}
          <div className="min-h-0 flex-1 space-y-8 overflow-y-auto px-5 py-6 sm:px-8">
            {flowStep !== "roster" && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="-ml-1 w-fit text-muted-foreground"
                onClick={goBack}
              >
                <ArrowLeft className="size-4" />
                Back to entries
              </Button>
            )}

            {flowStep === "auth" && (
              <RegistrationAuthPanel onAuthenticated={handleAuthenticated} />
            )}

            {flowStep === "register" && registrationOpen && (
              <DivisionRegisterForm
                slug={tournamentSlug}
                divisionId={divisionId}
                divisionName={roster?.divisionName ?? "Category"}
                format={format}
                feeCents={feeCents}
                currency={currency}
                waitlistEnabled={waitlistEnabled}
                allowPayAtVenue={allowPayAtVenue}
                capacity={capacity ?? roster?.capacity ?? null}
                taken={roster?.taken ?? taken}
                blockNewRegistration={Boolean(alreadyEntered && !needsUnpaidPay)}
                crossCategoryBlock={crossCategoryBlock}
                onComplete={handleRegisterComplete}
              />
            )}

            {flowStep === "pay" && (
              <>
                {payLoading || !payState ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="size-8 animate-spin text-brass" />
                  </div>
                ) : (
                  <CheckoutQrPanel
                    qrImageUrl={payState.qrImageUrl}
                    checkoutUrl={payState.checkoutUrl}
                    qrExpiresAt={payState.qrExpiresAt}
                    registrationId={payState.registrationId}
                    amountCents={payState.amountCents}
                    currency={currency}
                    paymentHoldExpiresAt={payState.paymentHoldExpiresAt}
                    onPaid={() => {
                      setSuccessKind("paid");
                      setFlowStep("success");
                      void load();
                      router.refresh();
                    }}
                    onHoldExpired={() => {
                      setPayState(null);
                      setFlowStep("roster");
                      void load();
                      router.refresh();
                    }}
                  />
                )}
              </>
            )}

            {flowStep === "success" && (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <span className="flex size-14 items-center justify-center rounded-full bg-bone text-ink">
                  <Check className="size-7" strokeWidth={3} />
                </span>
                <p className="display text-3xl text-bone">
                  {successKind === "waitlist"
                    ? waitlistPos
                      ? `Waitlist #${waitlistPos}`
                      : "On the waitlist"
                    : successKind === "venue"
                      ? "Slot reserved"
                      : successKind === "free" || successKind === "paid"
                        ? "You're in"
                        : "Done"}
                </p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  {successKind === "waitlist"
                    ? "No payment yet — we'll email you if a slot opens."
                    : successKind === "venue"
                      ? "Pay at the registration desk on the day."
                      : "Your entry is recorded for this category."}
                </p>
                <Button type="button" className="mt-2" onClick={() => setFlowStep("roster")}>
                  View who&apos;s in
                </Button>
              </div>
            )}

            {flowStep === "roster" && error && <p className="text-sm text-[#e58a72]">{error}</p>}

            {flowStep === "roster" && loading && (
              <ul className="grid gap-3 sm:grid-cols-2" aria-label="Loading entries">
                {Array.from({ length: 4 }, (_, i) => (
                  <CardSkeleton key={i} />
                ))}
              </ul>
            )}

            {flowStep === "roster" && roster && !loading && (
              <>
                {(showSlotGrid ? roster.slots.length > 0 : roster.slots.length > 6) && (
                  <label className="relative block">
                    <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
                    <span className="sr-only">Find a player</span>
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Find a player"
                      className="h-11 w-full rounded-xl border border-line bg-ink/40 pr-4 pl-10 text-sm text-bone outline-none placeholder:text-muted-foreground focus:border-umber"
                    />
                  </label>
                )}

                {showSlotGrid ? (
                  <>
                    <DivisionSlotGrid
                      capacity={slotCapacity}
                      entries={roster.slots}
                      registrationOpen={registrationOpen}
                      categoryFull={categoryFull}
                      searchQuery={q}
                      onClaimSlot={startRegistrationFlow}
                      onHoldExpire={() => void load()}
                    />
                    {q && roster.slots.every((e) => !matches(e)) && (
                      <p className="text-sm text-muted-foreground">No player matches &ldquo;{query}&rdquo;.</p>
                    )}
                    {categoryFull && registrationOpen && waitlistEnabled && (
                      <Button type="button" className="w-full" variant="secondary" onClick={startRegistrationFlow}>
                        <Ticket className="size-4" />
                        Join the waitlist
                      </Button>
                    )}
                  </>
                ) : roster.slots.length === 0 ? (
                  <div className="flex flex-col items-center rounded-2xl border border-dashed border-line px-6 py-12 text-center">
                    <span className="flex size-12 items-center justify-center rounded-full bg-umber/40 text-brass">
                      <Users className="size-5" />
                    </span>
                    <p className="mt-4 font-semibold text-bone">No entries yet</p>
                    <p className="mt-1 text-sm text-muted-foreground">Be the first to sign up for this category.</p>
                    {registrationOpen && (
                      <Button type="button" className="mt-4" size="sm" onClick={startRegistrationFlow}>
                        <Ticket className="size-4" />
                        Submit entry
                      </Button>
                    )}
                  </div>
                ) : slots.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No player matches &ldquo;{query}&rdquo;.</p>
                ) : (
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {slots.map((e, i) => (
                      <TeamCard
                        key={e.paymentHold ? `hold-${i}` : `${e.players.map((p) => p.name).join("|")}-${i}`}
                        entry={e}
                        index={i}
                        onHoldExpire={() => void load()}
                      />
                    ))}
                  </ul>
                )}

                {waitlistEnabled && (
                <section>
                  <h3 className="eyebrow flex items-center gap-2">
                    Waitlist
                    <span className="rounded-full border border-line px-1.5 font-mono text-[0.65rem] tracking-normal text-muted-foreground">
                      {roster.waitlist.length}
                    </span>
                  </h3>
                  {roster.waitlist.length === 0 ? (
                    <div className="mt-3 flex items-center gap-3 rounded-2xl border border-dashed border-line px-4 py-4">
                      <Clock className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      <p className="text-sm text-muted-foreground">
                        No one is waiting. If this category fills up, new teams line up here and only pay once a slot
                        opens.
                      </p>
                    </div>
                  ) : (
                    <ul className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line">
                      {roster.waitlist.map((e, i) => (
                        <li key={`wl-${i}`} className="flex items-center gap-3 bg-surface/60 px-4 py-3">
                          <span className="w-7 font-mono text-xs text-brass">#{e.waitlistPosition ?? i + 1}</span>
                          <div className="flex -space-x-2">
                            {e.players.map((p) => (
                              <PlayerAvatar key={p.name} name={p.name} src={p.avatarUrl} className="size-8 text-xs" />
                            ))}
                          </div>
                          <span className="min-w-0 truncate text-sm text-bone/85">
                            {e.players.map((p) => p.name).join(" & ")}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
                )}
              </>
            )}
          </div>

          {/* submit entry + petitions */}
          {roster && !loading && flowStep === "roster" && (
            <div className="shrink-0 space-y-0 border-t border-line bg-ink/40">
              {registrationOpen && !showSlotGrid && (
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4 sm:px-8">
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-medium text-bone">Register for this category</p>
                    <p className="text-muted-foreground">
                      {signedOut
                        ? "Log in or sign up to submit your entry."
                        : invitePending
                          ? "You were added as a partner here. Accept your invite before registering."
                          : alreadyEntered
                            ? needsUnpaidPay
                              ? "Complete payment to confirm your slot."
                              : "You're in this category."
                            : "Register and pay with QR without leaving this page."}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {invitePending && elig?.inviteToken ? (
                      <Button size="sm" asChild>
                        <Link href={`/invite/${elig.inviteToken}`}>Open invite</Link>
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        onClick={startRegistrationFlow}
                        disabled={!signedOut && invitePending}
                      >
                        <Ticket className="size-4" />
                        {signedOut
                          ? "Submit entry"
                          : alreadyEntered
                            ? needsUnpaidPay
                              ? "Pay now"
                              : "View entry"
                            : "Submit entry"}
                      </Button>
                    )}
                  </div>
                </div>
              )}
              {registrationOpen && showSlotGrid && needsUnpaidPay && (
                <div className="flex justify-end border-b border-line px-5 py-3 sm:px-8">
                  <Button type="button" size="sm" onClick={startRegistrationFlow}>
                    <Ticket className="size-4" />
                    Pay now
                  </Button>
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-8">
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-medium text-bone">Entry petition</p>
                  <p className="text-muted-foreground">
                    {!elig || elig.reason === "not_signed_in"
                      ? "Entered in this category? Log in to file a petition."
                      : elig.reason === "invite_pending"
                        ? "You were added as a partner here. Accept your invite first."
                        : elig.reason === "not_registered"
                          ? "Only players registered in this category can file a petition."
                          : elig.reason === "pending_exists"
                            ? "Your petition is under review."
                            : elig.existingPetition?.status === "rejected" && elig.existingPetition.reviewerNote
                              ? elig.existingPetition.reviewerNote
                              : "Need a change to your entry? Ask the organizer."}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {elig?.existingPetition && <StatusBadge status={elig.existingPetition.status} />}
                  {!elig || elig.reason === "not_signed_in" ? (
                    <Button type="button" size="sm" variant="secondary" onClick={openAuthForPetition}>
                      <Ticket className="size-4" />
                      Register
                    </Button>
                  ) : elig.reason === "invite_pending" && elig.inviteToken ? (
                    <Button size="sm" asChild>
                      <Link href={`/invite/${elig.inviteToken}`}>Open invite</Link>
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={!(elig.eligible && elig.registrationId && elig.entryName)}
                      onClick={() => setPetitionOpen(true)}
                      title={elig.eligible ? undefined : "Only players registered in this category can petition"}
                    >
                      {elig.eligible ? <FileText className="size-4" /> : <Lock className="size-4" />}
                      Apply petition
                    </Button>
                  )}
                </div>
              </div>
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
