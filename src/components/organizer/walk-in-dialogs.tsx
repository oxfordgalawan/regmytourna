"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote, Check, Loader2, QrCode, UserPlus } from "lucide-react";
import { toast } from "@/lib/ui/app-toast";
import {
  addWalkInEntryAction,
  createDeskQrAction,
  getEntryPaymentStatusAction,
  recordCashPaymentAction,
} from "@/app/actions/walk-in";
import { CheckoutQrPanel } from "@/components/payments/checkout-qr-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatPhp } from "@/lib/format";
import { QRPH_DESK_CHOOSE_HINT } from "@/lib/payments/qrph-desk-copy";
import { cn } from "@/lib/utils";
import { normalizePhilippineMobile } from "@/lib/validations/phone";

/** feeCents = amount to collect now (balance due, not always full category fee). */
export type CollectTarget = { id: string; player: string; division: string; feeCents: number };

type Step = "choose" | "cash" | "qr" | "paid" | "partial";

type QrSession = {
  qrImageUrl: string;
  checkoutUrl?: string | null;
  amountCents: number;
  expiresAt?: string | null;
};

function pesosToCents(raw: string): number {
  return Math.max(0, Math.round((Number(raw.replace(/,/g, "")) || 0) * 100));
}

/** Take payment at the desk: cash, or a PayMongo QR the player scans. */
export function CollectPaymentDialog({
  target,
  startWith = "choose",
  onClose,
}: {
  target: CollectTarget | null;
  startWith?: "choose" | "qr" | "cash";
  onClose: () => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(startWith === "qr" ? "choose" : startWith === "cash" ? "cash" : startWith);
  const [busy, setBusy] = useState(false);
  const [qrSession, setQrSession] = useState<QrSession | null>(null);
  const [cashPesos, setCashPesos] = useState("");
  const [paidMessage, setPaidMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!target) return;
    setCashPesos((target.feeCents / 100).toFixed(2));
    setPaidMessage(null);
    setQrSession(null);
    setStep(startWith === "qr" ? "choose" : startWith);
  }, [target?.id, target?.feeCents, startWith]);

  const pollDesk = useCallback(
    (registrationId: string) => getEntryPaymentStatusAction(registrationId),
    []
  );

  async function showQr() {
    if (!target) return;
    setBusy(true);
    const res = await createDeskQrAction(target.id);
    setBusy(false);
    if (res.error || !res.qrImageUrl) {
      toast.error(res.error ?? "Couldn't create the QR");
      return;
    }
    setQrSession({
      qrImageUrl: res.qrImageUrl,
      checkoutUrl: res.checkoutUrl,
      amountCents: res.amountCents ?? target.feeCents,
      expiresAt: res.expiresAt,
    });
    setStep("qr");
  }

  const autoStarted = useRef(false);
  useEffect(() => {
    if (startWith !== "qr" || autoStarted.current || !target) return;
    autoStarted.current = true;
    void showQr();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on open
  }, [target?.id]);

  async function cash() {
    if (!target) return;
    const cents = pesosToCents(cashPesos);
    if (cents <= 0) return toast.error("Enter how much cash you received.");
    if (cents > target.feeCents) {
      return toast.error(`Can't collect more than the balance due (${formatPhp(target.feeCents)}).`);
    }
    setBusy(true);
    const res = await recordCashPaymentAction(target.id, cents);
    setBusy(false);
    if (res.error) return toast.error(res.error);
    if (res.fullyPaid) {
      setPaidMessage(null);
      setStep("paid");
    } else {
      setPaidMessage(
        `Recorded ${formatPhp(res.recordedCents ?? cents)} — ${formatPhp(res.balanceDueCents ?? 0)} still due.`
      );
      setStep("partial");
    }
    router.refresh();
  }

  if (!target) return null;
  const amount = formatPhp(target.feeCents);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">{target.player}</DialogTitle>
          <DialogDescription>
            {target.division} · balance due{" "}
            <span className="font-mono text-bone">{amount}</span>
          </DialogDescription>
        </DialogHeader>

        {step === "choose" && (
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setStep("cash")}
              className="flex flex-col items-start gap-3 rounded-xl border border-line p-4 text-left transition-colors hover:border-bone/40 hover:bg-espresso/40"
            >
              <Banknote className="size-6 text-brass" />
              <span>
                <span className="block font-medium text-bone">Pay in cash</span>
                <span className="block text-xs text-muted-foreground">Enter amount received</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => void showQr()}
              disabled={busy}
              className="flex flex-col items-start gap-3 rounded-xl border border-line p-4 text-left transition-colors hover:border-bone/40 hover:bg-espresso/40 disabled:opacity-60"
            >
              {busy ? <Loader2 className="size-6 animate-spin text-brass" /> : <QrCode className="size-6 text-brass" />}
              <span>
                <span className="block font-medium text-bone">Pay with QR Ph</span>
                <span className="block text-xs text-muted-foreground">{QRPH_DESK_CHOOSE_HINT}</span>
              </span>
            </button>
          </div>
        )}

        {step === "cash" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="desk-cash-amount">Cash collected (PHP)</Label>
              <Input
                id="desk-cash-amount"
                inputMode="decimal"
                value={cashPesos}
                onChange={(e) => setCashPesos(e.target.value)}
                placeholder="0.00"
              />
              <p className="text-xs text-muted-foreground">
                Balance due: <span className="font-mono text-bone">{amount}</span>
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="px-0 text-brass"
              onClick={() => setCashPesos((target.feeCents / 100).toFixed(2))}
            >
              Use full balance ({amount})
            </Button>
          </div>
        )}

        {step === "qr" && qrSession && (
          <CheckoutQrPanel
            qrImageUrl={qrSession.qrImageUrl}
            checkoutUrl={qrSession.checkoutUrl}
            registrationId={target.id}
            amountCents={qrSession.amountCents}
            qrExpiresAt={qrSession.expiresAt}
            pollPaymentStatus={pollDesk}
            payPrompt="for this entry"
            paidSuccessTitle="Paid"
            paidSuccessSubtitle={`${target.player} is confirmed.`}
            onPaid={() => {
              setStep("paid");
              router.refresh();
            }}
            onPartial={(due) => {
              toast.message(`Partial payment received — ${formatPhp(due)} still due.`);
              router.refresh();
            }}
          />
        )}

        {step === "qr" && !qrSession && (
          <div className="flex justify-center py-12">
            <Loader2 className="size-8 animate-spin text-brass" />
          </div>
        )}

        {step === "paid" && (
          <div className="flex flex-col items-center gap-3 py-4 text-center animate-in zoom-in-95 fade-in-0">
            <span className="flex size-14 items-center justify-center rounded-full bg-bone text-ink">
              <Check className="size-7" strokeWidth={3} />
            </span>
            <p className="display text-3xl text-bone">Paid</p>
            <p className="text-sm text-muted-foreground">{target.player} is confirmed.</p>
          </div>
        )}

        {step === "partial" && paidMessage && (
          <div className="rounded-xl border border-line bg-ink/30 p-4 text-center text-sm text-bone/90">
            {paidMessage}
          </div>
        )}

        <DialogFooter>
          {step === "cash" && (
            <>
              <Button variant="ghost" onClick={() => setStep("choose")}>
                Back
              </Button>
              <Button onClick={() => void cash()} disabled={busy}>
                {busy ? <Loader2 className="animate-spin" /> : <Banknote />}
                Record cash
              </Button>
            </>
          )}
          {step === "qr" && (
            <Button variant="ghost" onClick={() => setStep("choose")}>
              Back
            </Button>
          )}
          {(step === "paid" || step === "partial" || step === "choose") && (
            <Button variant={step === "paid" || step === "partial" ? "default" : "ghost"} onClick={onClose}>
              {step === "paid" || step === "partial" ? "Done" : "Later"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export type WalkInCategory = {
  id: string;
  name: string;
  format: string;
  feeCents: number;
  capacity: number | null;
  taken: number;
  drawStarted: boolean;
};

/** Add an entry at the desk (no player account needed), then take payment. */
export function AddWalkInDialog({
  tournamentId,
  categories,
  open,
  onClose,
  onCollect,
}: {
  tournamentId: string;
  categories: WalkInCategory[];
  open: boolean;
  onClose: () => void;
  onCollect: (target: CollectTarget, how: "cash" | "qr") => void;
}) {
  const router = useRouter();
  const [divisionId, setDivisionId] = useState("");
  const [playerFirst, setPlayerFirst] = useState("");
  const [playerLast, setPlayerLast] = useState("");
  const [partnerFirst, setPartnerFirst] = useState("");
  const [partnerLast, setPartnerLast] = useState("");
  const [playerPhone, setPlayerPhone] = useState("");
  const [playerEmail, setPlayerEmail] = useState("");
  const [partnerPhone, setPartnerPhone] = useState("");
  const [partnerEmail, setPartnerEmail] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const category = categories.find((c) => c.id === divisionId);
  const doubles = category?.format === "doubles";
  const feeApplies = (category?.feeCents ?? 0) > 0;

  const namesOk =
    Boolean(playerFirst.trim() && playerLast.trim()) &&
    (!doubles || (partnerFirst.trim() && partnerLast.trim()));
  const phonesOk =
    Boolean(normalizePhilippineMobile(playerPhone)) &&
    (!doubles || Boolean(normalizePhilippineMobile(partnerPhone)));
  const formOk = namesOk && phonesOk;

  function resetForm() {
    setPlayerFirst("");
    setPlayerLast("");
    setPartnerFirst("");
    setPartnerLast("");
    setPlayerPhone("");
    setPlayerEmail("");
    setPartnerPhone("");
    setPartnerEmail("");
  }

  async function add(pay: "cash" | "qr" | "later") {
    if (!category) return toast.error("Choose a category.");
    if (!formOk) return toast.error("Enter names and valid 09 mobile numbers.");
    setBusy(pay);
    const res = await addWalkInEntryAction(tournamentId, {
      divisionId,
      playerFirstName: playerFirst,
      playerLastName: playerLast,
      playerPhone,
      playerEmail: playerEmail.trim() || undefined,
      partnerFirstName: doubles ? partnerFirst : undefined,
      partnerLastName: doubles ? partnerLast : undefined,
      partnerPhone: doubles ? partnerPhone : undefined,
      partnerEmail: doubles ? partnerEmail.trim() || undefined : undefined,
    });
    setBusy(null);
    if (res.error || !res.registrationId) return toast.error(res.error ?? "Couldn't add the entry");
    const p1 = [playerFirst.trim(), playerLast.trim()].filter(Boolean).join(" ");
    const p2 = [partnerFirst.trim(), partnerLast.trim()].filter(Boolean).join(" ");
    const name = doubles && p2 ? `${p1} / ${p2}` : p1;
    resetForm();
    router.refresh();
    onClose();
    if (pay !== "later" && feeApplies) {
      onCollect({ id: res.registrationId, player: name, division: category.name, feeCents: res.feeCents ?? 0 }, pay);
    } else {
      toast.success(`${name} added${feeApplies ? " — payment pending" : ""}`);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg">Add players manually</DialogTitle>
          <DialogDescription>
            Add an entry any time before or during the event. Phone is required; with an email, the player can link the
            entry when they sign up or log in.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Category</Label>
            <div className="grid gap-2" role="radiogroup" aria-label="Category">
              {categories.map((c) => {
                const full = c.capacity !== null && c.taken >= c.capacity;
                const disabled = full || c.drawStarted;
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={divisionId === c.id}
                    disabled={disabled}
                    onClick={() => setDivisionId(c.id)}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                      divisionId === c.id ? "border-bone bg-bone/[0.06]" : "border-line hover:border-bone/30"
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-bone">{c.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {c.drawStarted
                          ? "Draw already started"
                          : full
                            ? "Full"
                            : c.capacity
                              ? `${c.capacity - c.taken} of ${c.capacity} slots left`
                              : "No limit"}
                      </span>
                    </span>
                    <span className="font-mono text-sm text-bone/80">{formatPhp(c.feeCents)}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm text-bone">{doubles ? "Player 1" : "Player"}</Label>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  id="walkin-player-first"
                  value={playerFirst}
                  onChange={(e) => setPlayerFirst(e.target.value)}
                  placeholder="First name"
                  autoComplete="off"
                />
                <Input
                  id="walkin-player-last"
                  value={playerLast}
                  onChange={(e) => setPlayerLast(e.target.value)}
                  placeholder="Last name"
                  autoComplete="off"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  id="walkin-player-phone"
                  type="tel"
                  inputMode="numeric"
                  value={playerPhone}
                  onChange={(e) => setPlayerPhone(e.target.value)}
                  placeholder="Mobile (09XXXXXXXXX)"
                  autoComplete="tel"
                />
                <Input
                  id="walkin-player-email"
                  type="email"
                  value={playerEmail}
                  onChange={(e) => setPlayerEmail(e.target.value)}
                  placeholder="Email (optional)"
                  autoComplete="email"
                />
              </div>
            </div>
            {doubles && (
              <div className="animate-in fade-in-0 space-y-2">
                <Label className="text-sm text-bone">Player 2</Label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    id="walkin-partner-first"
                    value={partnerFirst}
                    onChange={(e) => setPartnerFirst(e.target.value)}
                    placeholder="First name"
                    autoComplete="off"
                  />
                  <Input
                    id="walkin-partner-last"
                    value={partnerLast}
                    onChange={(e) => setPartnerLast(e.target.value)}
                    placeholder="Last name"
                    autoComplete="off"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    id="walkin-partner-phone"
                    type="tel"
                    inputMode="numeric"
                    value={partnerPhone}
                    onChange={(e) => setPartnerPhone(e.target.value)}
                    placeholder="Mobile (09XXXXXXXXX)"
                    autoComplete="tel"
                  />
                  <Input
                    id="walkin-partner-email"
                    type="email"
                    value={partnerEmail}
                    onChange={(e) => setPartnerEmail(e.target.value)}
                    placeholder="Email (optional)"
                    autoComplete="email"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex-wrap">
          <Button variant="ghost" onClick={() => add("later")} disabled={busy !== null || !formOk}>
            {busy === "later" ? <Loader2 className="animate-spin" /> : <UserPlus />}
            Pay later
          </Button>
          <Button
            variant="outline"
            onClick={() => add("qr")}
            disabled={busy !== null || !formOk || !feeApplies}
            title={!feeApplies ? "No entry fee for this category" : undefined}
          >
            {busy === "qr" ? <Loader2 className="animate-spin" /> : <QrCode />}
            Pay with QR Ph
          </Button>
          <Button onClick={() => add("cash")} disabled={busy !== null || !formOk || !feeApplies}>
            {busy === "cash" ? <Loader2 className="animate-spin" /> : <Banknote />}
            Pay in cash
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}