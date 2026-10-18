"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { Banknote, Check, Loader2, QrCode, UserPlus } from "lucide-react";
import { toast } from "@/lib/ui/app-toast";
import {
  addWalkInEntryAction,
  createDeskQrAction,
  getEntryPaymentStatusAction,
  recordCashPaymentAction,
} from "@/app/actions/walk-in";
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
import {
  QRPH_DESK_CHOOSE_HINT,
  QRPH_DESK_COMPATIBILITY_NOTE,
  QRPH_DESK_SCAN_REMINDER,
} from "@/lib/payments/qrph-desk-copy";
import { cn } from "@/lib/utils";

export type CollectTarget = { id: string; player: string; division: string; feeCents: number };

type Step = "choose" | "cash" | "qr" | "paid";

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
  const [step, setStep] = useState<Step>(startWith === "qr" ? "choose" : startWith);
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState<string | null>(null);

  async function showQr() {
    if (!target) return;
    setBusy(true);
    const res = await createDeskQrAction(target.id);
    if (res.error || !res.checkoutUrl) {
      setBusy(false);
      toast.error(res.error ?? "Couldn't create the QR");
      return;
    }
    setQr(await QRCode.toDataURL(res.checkoutUrl, { width: 320, margin: 2 }));
    setBusy(false);
    setStep("qr");
  }

  // open straight on the QR when asked to (e.g. right after adding a walk-in);
  // the ref keeps a dev-mode double effect from creating two checkouts
  const autoStarted = useRef(false);
  useEffect(() => {
    if (startWith !== "qr" || autoStarted.current) return;
    autoStarted.current = true;
    void showQr();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on open
  }, []);

  // while the QR is up, check every few seconds whether the payment landed
  useEffect(() => {
    if (step !== "qr" || !target) return;
    const id = window.setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      const res = await getEntryPaymentStatusAction(target.id);
      if (res.paid) {
        setStep("paid");
        router.refresh();
      }
    }, 3000);
    return () => window.clearInterval(id);
  }, [step, target, router]);

  async function cash() {
    if (!target) return;
    setBusy(true);
    const res = await recordCashPaymentAction(target.id);
    setBusy(false);
    if (res.error) return toast.error(res.error);
    setStep("paid");
    router.refresh();
  }

  if (!target) return null;
  const amount = formatPhp(target.feeCents);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">{target.player}</DialogTitle>
          <DialogDescription>
            {target.division} · <span className="font-mono text-bone">{amount}</span>
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
                <span className="block font-medium text-bone">Paid in cash</span>
                <span className="block text-xs text-muted-foreground">You received {amount}</span>
              </span>
            </button>
            <button
              type="button"
              onClick={showQr}
              disabled={busy}
              className="flex flex-col items-start gap-3 rounded-xl border border-line p-4 text-left transition-colors hover:border-bone/40 hover:bg-espresso/40 disabled:opacity-60"
            >
              {busy ? <Loader2 className="size-6 animate-spin text-brass" /> : <QrCode className="size-6 text-brass" />}
              <span>
                <span className="block font-medium text-bone">Show QR</span>
                <span className="block text-xs text-muted-foreground">{QRPH_DESK_CHOOSE_HINT}</span>
              </span>
            </button>
          </div>
        )}

        {step === "cash" && (
          <div className="rounded-xl border border-line bg-ink/30 p-4 text-sm text-bone/85">
            Confirm you received <span className="font-mono text-bone">{amount}</span> in cash from{" "}
            {target.player}. The entry is confirmed straight away.
          </div>
        )}

        {step === "qr" && (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="rounded-2xl bg-white p-3">
              {qr ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qr} alt="Payment QR code" width={280} height={280} />
              ) : (
                <div className="flex size-[280px] items-center justify-center text-ink/60">
                  <Loader2 className="animate-spin" />
                </div>
              )}
            </div>
            <p
              className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-left text-sm text-bone/90"
              role="note"
            >
              {QRPH_DESK_COMPATIBILITY_NOTE}
            </p>
            <p className="flex flex-col items-center gap-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <Loader2 className="size-3.5 animate-spin" />
                Waiting for payment — this updates by itself.
              </span>
              <span className="text-xs">{QRPH_DESK_SCAN_REMINDER}</span>
            </p>
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

        <DialogFooter>
          {step === "cash" && (
            <>
              <Button variant="ghost" onClick={() => setStep("choose")}>
                Back
              </Button>
              <Button onClick={cash} disabled={busy}>
                {busy ? <Loader2 className="animate-spin" /> : <Banknote />}
                Confirm {amount} cash
              </Button>
            </>
          )}
          {step === "qr" && (
            <Button variant="ghost" onClick={() => setStep("choose")}>
              Back
            </Button>
          )}
          {(step === "paid" || step === "choose") && (
            <Button variant={step === "paid" ? "default" : "ghost"} onClick={onClose}>
              {step === "paid" ? "Done" : "Later"}
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
  const [player, setPlayer] = useState("");
  const [partner, setPartner] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const category = categories.find((c) => c.id === divisionId);
  const doubles = category?.format === "doubles";

  async function add(pay: "cash" | "qr" | "later") {
    if (!category) return toast.error("Choose a category.");
    setBusy(pay);
    const res = await addWalkInEntryAction(tournamentId, { divisionId, playerName: player, partnerName: partner });
    setBusy(null);
    if (res.error || !res.registrationId) return toast.error(res.error ?? "Couldn't add the entry");
    const name = doubles && partner.trim() ? `${player.trim()} / ${partner.trim()}` : player.trim();
    setPlayer("");
    setPartner("");
    router.refresh();
    onClose();
    if (pay !== "later" && (res.feeCents ?? 0) > 0) {
      onCollect({ id: res.registrationId, player: name, division: category.name, feeCents: res.feeCents ?? 0 }, pay);
    } else {
      toast.success(`${name} added${(res.feeCents ?? 0) > 0 ? " — payment pending" : ""}`);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg">Add a walk-in</DialogTitle>
          <DialogDescription>For players registering at the venue. No account needed.</DialogDescription>
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
          <div className={cn("grid gap-3", doubles && "sm:grid-cols-2")}>
            <div className="space-y-2">
              <Label htmlFor="walkin-player">{doubles ? "Player 1" : "Player"}</Label>
              <Input id="walkin-player" value={player} onChange={(e) => setPlayer(e.target.value)} placeholder="Full name" autoComplete="off" />
            </div>
            {doubles && (
              <div className="space-y-2 animate-in fade-in-0">
                <Label htmlFor="walkin-partner">Player 2</Label>
                <Input id="walkin-partner" value={partner} onChange={(e) => setPartner(e.target.value)} placeholder="Partner's full name" autoComplete="off" />
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex-wrap">
          <Button variant="ghost" onClick={() => add("later")} disabled={busy !== null || !player.trim()}>
            {busy === "later" ? <Loader2 className="animate-spin" /> : <UserPlus />}
            Add, pay later
          </Button>
          <Button variant="outline" onClick={() => add("qr")} disabled={busy !== null || !player.trim()}>
            {busy === "qr" ? <Loader2 className="animate-spin" /> : <QrCode />}
            Add & show QR
          </Button>
          <Button onClick={() => add("cash")} disabled={busy !== null || !player.trim()}>
            {busy === "cash" ? <Loader2 className="animate-spin" /> : <Banknote />}
            Add & take cash
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
