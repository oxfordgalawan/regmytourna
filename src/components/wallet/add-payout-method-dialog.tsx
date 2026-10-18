"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, ChevronRight, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "@/lib/ui/app-toast";
import { savePayoutMethod } from "@/app/actions/payout-methods";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { MethodMark } from "@/components/wallet/payout-method-ui";
import {
  PAYOUT_METHOD_TYPES,
  PH_BANKS,
  maskAccountNumber,
  stripAccountNumber,
  validatePayoutMethod,
  type PayoutMethodType,
} from "@/lib/payout-methods/config";
import { cn } from "@/lib/utils";

type Step = "type" | "details" | "review" | "done";

const TYPE_HINT: Record<PayoutMethodType, string> = {
  gcash: "Fastest — usually same day",
  maya: "Fast — usually same day",
  bank: "Any Philippine bank account",
  other: "Tell us how to send it",
};

/** 09171234567 → 0917 123 4567 */
function formatMobile(raw: string) {
  const d = stripAccountNumber(raw).slice(0, 11);
  return [d.slice(0, 4), d.slice(4, 7), d.slice(7)].filter(Boolean).join(" ");
}

/**
 * Add a payout method in three short steps: pick how to get paid, enter the
 * details, double-check. Lives in a modal so the wallet stays in view.
 */
export function AddPayoutMethodDialog({
  open,
  onOpenChange,
  isFirst,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isFirst: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<Step>("type");
  const [type, setType] = useState<PayoutMethodType>("gcash");
  const [accountName, setAccountName] = useState("");
  const [number, setNumber] = useState("");
  const [bank, setBank] = useState("");
  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [isDefault, setIsDefault] = useState(isFirst);
  const config = PAYOUT_METHOD_TYPES.find((t) => t.value === type)!;
  const mobile = type === "gcash" || type === "maya";

  const problem =
    accountName.trim().length < 2
      ? "Enter the account holder's name."
      : validatePayoutMethod({ methodType: type, accountNumber: number, bankName: bank });
  const suggestedLabel =
    type === "bank"
      ? `${bank || "Bank"} ${maskAccountNumber("bank", number)}`.trim()
      : type === "other"
        ? "Other payout"
        : `My ${config.label}`;

  function reset() {
    setStep("type");
    setAccountName("");
    setNumber("");
    setBank("");
    setLabel("");
    setNotes("");
    setIsDefault(isFirst);
  }

  function close(next: boolean) {
    if (pending) return;
    onOpenChange(next);
    if (!next) setTimeout(reset, 200);
  }

  function save() {
    startTransition(async () => {
      const res = await savePayoutMethod({
        label: label.trim() || suggestedLabel,
        methodType: type,
        accountName,
        accountNumber: number,
        bankName: type === "bank" ? bank : "",
        notes,
        isDefault,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setStep("done");
      router.refresh();
      setTimeout(() => close(false), 1200);
    });
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="gap-0 overflow-hidden border border-umber bg-espresso p-0 sm:max-w-md">
        <div className="flex items-center gap-3 border-b border-line px-5 pt-5 pb-4">
          {(step === "details" || step === "review") && (
            <button
              type="button"
              onClick={() => setStep(step === "review" ? "details" : "type")}
              className="flex size-9 shrink-0 items-center justify-center rounded-full border border-line text-bone hover:border-umber"
              aria-label="Back"
            >
              <ArrowLeft className="size-4" />
            </button>
          )}
          <div className="min-w-0 pr-6">
            <DialogTitle className="text-base text-bone">
              {step === "type"
                ? "How do you want to get paid?"
                : step === "details"
                  ? `${config.label} details`
                  : step === "review"
                    ? "Double-check"
                    : "Payout method saved"}
            </DialogTitle>
            <DialogDescription>
              {step === "done" ? "You can withdraw to it any time." : `Step ${step === "type" ? 1 : step === "details" ? 2 : 3} of 3`}
            </DialogDescription>
          </div>
        </div>

        <div key={step} className="max-h-[75dvh] animate-rise overflow-y-auto px-5 py-5">
          {step === "type" && (
            <div className="space-y-2">
              {PAYOUT_METHOD_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => {
                    setType(t.value);
                    setStep("details");
                  }}
                  className="group flex w-full items-center gap-3.5 rounded-xl border border-line bg-surface px-4 py-3.5 text-left transition-colors hover:border-umber"
                >
                  <MethodMark type={t.value} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-bone">{t.label}</span>
                    <span className="block text-xs text-muted-foreground">{TYPE_HINT[t.value]}</span>
                  </span>
                  <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </button>
              ))}
            </div>
          )}

          {step === "details" && (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!problem) setStep("review");
              }}
            >
              {type === "bank" && (
                <div className="space-y-2">
                  <Label htmlFor="pm-bank">Bank</Label>
                  <select
                    id="pm-bank"
                    value={bank}
                    onChange={(e) => setBank(e.target.value)}
                    className="h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm text-bone outline-none focus:border-umber"
                  >
                    <option value="">Choose your bank</option>
                    {PH_BANKS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="pm-name">Account holder name</Label>
                <Input
                  id="pm-name"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="As it appears on the account"
                  autoComplete="name"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pm-number">{config.numberLabel}</Label>
                <Input
                  id="pm-number"
                  value={mobile ? formatMobile(number) : number}
                  onChange={(e) => setNumber(mobile ? stripAccountNumber(e.target.value) : e.target.value)}
                  placeholder={config.placeholder}
                  inputMode={type === "other" ? "text" : "numeric"}
                  autoComplete="off"
                  className="font-mono tracking-wide"
                />
                <p className="text-xs text-muted-foreground">{config.hint}</p>
              </div>
              {type === "other" && (
                <div className="space-y-2">
                  <Label htmlFor="pm-notes">Instructions (optional)</Label>
                  <Input id="pm-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Coins.ph" />
                </div>
              )}
              <Button type="submit" size="lg" className="w-full" disabled={Boolean(problem)}>
                Continue
              </Button>
              {problem && (accountName || number) && <p className="text-center text-xs text-muted-foreground">{problem}</p>}
            </form>
          )}

          {step === "review" && (
            <div className="space-y-5">
              {/* preview of the saved card */}
              <div className="grain relative overflow-hidden rounded-2xl border border-umber bg-gradient-to-br from-umber/60 to-ink p-5">
                <div className="court-grid pointer-events-none absolute inset-0 opacity-30" />
                <div className="relative flex items-start justify-between">
                  <MethodMark type={type} />
                  <span className="font-mono text-[0.65rem] tracking-widest text-bone/60 uppercase">
                    {type === "bank" ? bank : config.label}
                  </span>
                </div>
                <p className="relative mt-6 font-mono text-xl tracking-widest text-bone">
                  {mobile ? formatMobile(number) : number}
                </p>
                <p className="relative mt-1 text-sm text-bone/75">{accountName}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pm-label">Nickname</Label>
                <Input id="pm-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={suggestedLabel} />
              </div>

              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-line px-4 py-3">
                <span>
                  <span className="block text-sm font-medium text-bone">Use as default</span>
                  <span className="block text-xs text-muted-foreground">Pre-selected when you withdraw</span>
                </span>
                <span className="relative inline-flex shrink-0">
                  <input
                    type="checkbox"
                    checked={isDefault}
                    onChange={(e) => setIsDefault(e.target.checked)}
                    className="peer sr-only"
                  />
                  <span className="h-6 w-11 rounded-full bg-surface-2 ring-1 ring-line transition-colors peer-checked:bg-bone" />
                  <span className="absolute top-1 left-1 size-4 rounded-full bg-bone/70 transition-all peer-checked:translate-x-5 peer-checked:bg-ink" />
                </span>
              </label>

              <p className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
                <ShieldCheck className="size-4 shrink-0 text-brass" />
                Withdrawals go only to this account. Check the number — a wrong one can&apos;t be reversed.
              </p>

              <Button size="lg" className="w-full" disabled={pending} onClick={save}>
                {pending && <Loader2 className="animate-spin" />}
                Save payout method
              </Button>
            </div>
          )}

          {step === "done" && (
            <div className="flex flex-col items-center py-6 text-center">
              <span className="flex size-14 animate-[pop_400ms_cubic-bezier(.2,1.4,.4,1)_both] items-center justify-center rounded-full bg-bone text-ink">
                <Check className="size-7" strokeWidth={3} />
              </span>
              <p className={cn("mt-4 font-semibold text-bone")}>{label.trim() || suggestedLabel}</p>
              <p className="text-sm text-muted-foreground">is ready for withdrawals.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
