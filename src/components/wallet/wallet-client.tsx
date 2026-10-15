"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Check,
  Clock,
  Loader2,
  MoreHorizontal,
  Plus,
  QrCode,
  Star,
  Trash2,
  Wifi,
} from "lucide-react";
import { toast } from "sonner";
import { requestWalletWithdrawal } from "@/app/actions/withdrawals";
import { deletePayoutMethod, setDefaultPayoutMethod } from "@/app/actions/payout-methods";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AddPayoutMethodDialog } from "@/components/wallet/add-payout-method-dialog";
import { MethodMark, methodSummary } from "@/components/wallet/payout-method-ui";
import { formatDateTime, formatPhp } from "@/lib/format";
import type { PayoutMethod, WalletActivity, WithdrawalRow } from "@/lib/wallet/overview";
import { cn } from "@/lib/utils";

/* ─────────────────────────── Balance card ─────────────────────────── */

export function BalanceCard({
  balanceCents,
  pendingWithdrawalCents,
  monthNetCents,
  minWithdrawalCents,
  methods,
}: {
  balanceCents: number;
  pendingWithdrawalCents: number;
  monthNetCents: number;
  minWithdrawalCents: number;
  methods: PayoutMethod[];
}) {
  const [withdrawing, setWithdrawing] = useState(false);
  const [adding, setAdding] = useState(false);
  const def = methods.find((m) => m.is_default) ?? methods[0] ?? null;

  return (
    <>
      <section className="grain relative isolate overflow-hidden rounded-3xl border border-umber bg-gradient-to-br from-umber via-espresso to-ink p-6 shadow-[0_30px_80px_-40px_rgba(185,142,90,0.45)] sm:p-8">
        <div className="court-grid pointer-events-none absolute inset-0 opacity-30" />
        <div className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-brass/20 blur-3xl" />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow text-bone/70">Available balance</p>
            <p
              className={cn(
                "display mt-2 text-6xl tabular-nums sm:text-7xl",
                balanceCents < 0 ? "text-[#e58a72]" : "text-bone"
              )}
            >
              {formatPhp(balanceCents)}
            </p>
            {balanceCents < 0 && (
              <p className="mt-1 text-xs text-bone/70">
                Platform fees on cash entries — settled from your next online payments.
              </p>
            )}
          </div>
          <Wifi className="size-6 rotate-90 text-bone/40" aria-hidden />
        </div>

        <div className="relative mt-8 grid grid-cols-2 gap-4 sm:max-w-md">
          <div>
            <p className="text-xs text-bone/60">This month</p>
            <p className="mt-0.5 font-mono text-lg text-bone">+{formatPhp(monthNetCents)}</p>
          </div>
          <div>
            <p className="text-xs text-bone/60">Withdrawal in review</p>
            <p className="mt-0.5 font-mono text-lg text-bone">{formatPhp(pendingWithdrawalCents)}</p>
          </div>
        </div>

        <div className="relative mt-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            <Button size="lg" onClick={() => (methods.length ? setWithdrawing(true) : setAdding(true))}>
              <ArrowUpRight />
              Withdraw
            </Button>
            <Button size="lg" variant="outline" className="bg-ink/30 backdrop-blur" onClick={() => setAdding(true)}>
              <Plus />
              Payout method
            </Button>
          </div>
          {def && (
            <span className="flex items-center gap-2 text-xs text-bone/70">
              <MethodMark type={def.method_type} className="size-7 rounded-lg text-xs" />
              {methodSummary(def)}
            </span>
          )}
        </div>
      </section>

      <WithdrawDialog
        open={withdrawing}
        onOpenChange={setWithdrawing}
        balanceCents={balanceCents}
        minWithdrawalCents={minWithdrawalCents}
        methods={methods}
      />
      <AddPayoutMethodDialog open={adding} onOpenChange={setAdding} isFirst={!methods.length} />
    </>
  );
}

/* ─────────────────────────── Withdraw ─────────────────────────── */

function WithdrawDialog({
  open,
  onOpenChange,
  balanceCents,
  minWithdrawalCents,
  methods,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  balanceCents: number;
  minWithdrawalCents: number;
  methods: PayoutMethod[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pesos, setPesos] = useState("");
  const [methodId, setMethodId] = useState((methods.find((m) => m.is_default) ?? methods[0])?.id ?? "");
  const [done, setDone] = useState(false);
  const cents = Math.round((Number(pesos.replace(/,/g, "")) || 0) * 100);
  const max = Math.max(0, balanceCents);
  const problem =
    max < minWithdrawalCents
      ? `You can withdraw once your balance reaches ${formatPhp(minWithdrawalCents)}.`
      : cents <= 0
        ? null
        : cents < minWithdrawalCents
          ? `Minimum withdrawal is ${formatPhp(minWithdrawalCents)}.`
          : cents > max
            ? `You only have ${formatPhp(max)} available.`
            : null;
  const method = methods.find((m) => m.id === methodId);

  function close(o: boolean) {
    if (pending) return;
    onOpenChange(o);
    if (!o)
      setTimeout(() => {
        setPesos("");
        setDone(false);
      }, 200);
  }

  function submit() {
    startTransition(async () => {
      const res = await requestWalletWithdrawal({ amountCents: cents, payoutMethodId: methodId });
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      setDone(true);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="gap-0 overflow-hidden border border-umber bg-espresso p-0 sm:max-w-md">
        <div className="border-b border-line px-5 pt-5 pb-4">
          <DialogTitle className="text-base text-bone">{done ? "Withdrawal requested" : "Withdraw funds"}</DialogTitle>
          <DialogDescription>
            {done ? "We'll email you when it's approved." : `${formatPhp(max)} available`}
          </DialogDescription>
        </div>

        {done ? (
          <div className="flex flex-col items-center px-5 py-8 text-center animate-rise">
            <span className="flex size-14 animate-[pop_400ms_cubic-bezier(.2,1.4,.4,1)_both] items-center justify-center rounded-full bg-bone text-ink">
              <Check className="size-7" strokeWidth={3} />
            </span>
            <p className="display mt-4 text-4xl text-bone">{formatPhp(cents)}</p>
            <p className="mt-1 text-sm text-muted-foreground">to {method ? methodSummary(method) : "your account"}</p>
            <p className="mt-4 max-w-xs text-xs text-muted-foreground">
              An admin reviews every withdrawal before sending it. You can follow it under Withdrawals.
            </p>
            <Button className="mt-6" onClick={() => close(false)}>
              Done
            </Button>
          </div>
        ) : (
          <div className="space-y-5 px-5 py-5">
            <div className="rounded-2xl border border-line bg-ink/40 px-4 py-5 text-center">
              <label htmlFor="wd-amount" className="sr-only">
                Amount in pesos
              </label>
              <div className="flex items-baseline justify-center gap-1">
                <span className="display text-3xl text-muted-foreground">₱</span>
                <input
                  id="wd-amount"
                  inputMode="decimal"
                  autoFocus
                  value={pesos}
                  onChange={(e) => setPesos(e.target.value.replace(/[^\d.,]/g, ""))}
                  placeholder="0"
                  className="display w-full max-w-[12rem] bg-transparent text-center text-5xl text-bone outline-none placeholder:text-muted-foreground/40"
                />
              </div>
              <div className="mt-4 flex justify-center gap-2">
                {[0.25, 0.5, 1].map((f) => (
                  <button
                    key={f}
                    type="button"
                    disabled={max <= 0}
                    onClick={() => setPesos(String(Math.floor((max * f) / 100)))}
                    className="rounded-full border border-line px-3 py-1 text-xs text-bone/80 transition-colors hover:border-umber hover:text-bone disabled:opacity-40"
                  >
                    {f === 1 ? "All" : `${f * 100}%`}
                  </button>
                ))}
              </div>
            </div>

            <fieldset className="space-y-2">
              <legend className="eyebrow mb-2">Send to</legend>
              {methods.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMethodId(m.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
                    m.id === methodId ? "border-bone bg-bone/[0.06]" : "border-line hover:border-umber"
                  )}
                >
                  <MethodMark type={m.method_type} className="size-9" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-bone">{m.label}</span>
                    <span className="block truncate font-mono text-[0.7rem] text-muted-foreground">{methodSummary(m)}</span>
                  </span>
                  {m.id === methodId && <Check className="size-4 text-bone" />}
                </button>
              ))}
            </fieldset>

            {problem && <p className="text-center text-xs text-[#e58a72]">{problem}</p>}

            <Button size="lg" className="w-full" disabled={pending || !methodId || cents <= 0 || Boolean(problem)} onClick={submit}>
              {pending && <Loader2 className="animate-spin" />}
              {cents > 0 ? `Withdraw ${formatPhp(cents)}` : "Enter an amount"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Reviewed by an admin before it&apos;s sent. Minimum {formatPhp(minWithdrawalCents)}.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────────────────── Payout methods ─────────────────────────── */

export function PayoutMethodsList({ methods }: { methods: PayoutMethod[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<PayoutMethod | null>(null);
  const [pending, startTransition] = useTransition();

  function makeDefault(m: PayoutMethod) {
    startTransition(async () => {
      const res = await setDefaultPayoutMethod(m.id);
      if (res.error) toast.error(res.error);
      else {
        toast.success(`${m.label} is now your default`);
        router.refresh();
      }
    });
  }

  function remove() {
    if (!removing) return;
    startTransition(async () => {
      const res = await deletePayoutMethod(removing.id);
      if (res.error) toast.error(res.error);
      else {
        toast.success("Payout method removed");
        setRemoving(null);
        router.refresh();
      }
    });
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {methods.map((m) => (
          <div key={m.id} className="relative flex items-center gap-3 rounded-2xl border border-line bg-surface p-4">
            <MethodMark type={m.method_type} />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 truncate text-sm font-semibold text-bone">
                {m.label}
                {m.is_default && (
                  <span className="rounded-full bg-brass/15 px-2 py-0.5 text-[0.6rem] font-medium tracking-wide text-brass uppercase">
                    Default
                  </span>
                )}
              </p>
              <p className="truncate font-mono text-[0.7rem] text-muted-foreground">{methodSummary(m)}</p>
              <p className="truncate text-xs text-muted-foreground">{m.account_name}</p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button size="icon-sm" variant="ghost" aria-label={`Options for ${m.label}`}>
                    <MoreHorizontal />
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                {!m.is_default && (
                  <DropdownMenuItem onClick={() => makeDefault(m)} disabled={pending}>
                    <Star />
                    Make default
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem variant="destructive" onClick={() => setRemoving(m)}>
                  <Trash2 />
                  Remove
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
        {methods.length < 3 && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex min-h-[5.5rem] items-center justify-center gap-2 rounded-2xl border border-dashed border-line text-sm text-muted-foreground transition-colors hover:border-umber hover:text-bone"
          >
            <Plus className="size-4" />
            Add payout method
          </button>
        )}
      </div>

      <AddPayoutMethodDialog open={adding} onOpenChange={setAdding} isFirst={!methods.length} />

      <Dialog open={Boolean(removing)} onOpenChange={(o) => !o && !pending && setRemoving(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogTitle>Remove {removing?.label}?</DialogTitle>
          <DialogDescription>
            You won&apos;t be able to withdraw to it anymore. Withdrawals already requested still go to this account.
          </DialogDescription>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" disabled={pending} onClick={() => setRemoving(null)}>
              Keep it
            </Button>
            <Button variant="destructive" disabled={pending} onClick={remove}>
              {pending && <Loader2 className="animate-spin" />}
              Remove
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ─────────────────────────── Activity ─────────────────────────── */

const FILTERS = [
  { key: "all", label: "All" },
  { key: "in", label: "Money in" },
  { key: "fees", label: "Cash fees" },
  { key: "out", label: "Withdrawals" },
] as const;

export function ActivityList({ activity }: { activity: WalletActivity[] }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [limit, setLimit] = useState(20);
  const rows = useMemo(
    () =>
      activity.filter((a) =>
        filter === "all"
          ? true
          : filter === "in"
            ? a.kind === "entry"
            : filter === "fees"
              ? a.kind === "cash_fee"
              : a.kind === "withdrawal"
      ),
    [activity, filter]
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-xs transition-colors",
              filter === f.key ? "border-bone bg-bone text-ink" : "border-line text-muted-foreground hover:text-bone"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {!rows.length ? (
        <p className="rounded-2xl border border-dashed border-line px-5 py-10 text-center text-sm text-muted-foreground">
          Nothing here yet.
        </p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
          {rows.slice(0, limit).map((a) => {
            const incoming = a.amountCents > 0;
            const Icon =
              a.kind === "withdrawal" ? ArrowUpRight : a.kind === "cash_fee" ? Banknote : a.channel === "qr" ? QrCode : ArrowDownLeft;
            return (
              <li key={a.id} className="flex items-center gap-3 bg-surface px-4 py-3.5">
                <span
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-full",
                    incoming ? "bg-brass/15 text-brass" : "bg-surface-2 text-muted-foreground"
                  )}
                >
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-bone">{a.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[a.eventName, a.subtitle].filter(Boolean).join(" · ") || formatDateTime(a.createdAt)}
                  </p>
                  {a.kind === "entry" && a.grossCents !== null && (
                    <p className="truncate font-mono text-[0.65rem] text-muted-foreground/80">
                      {formatPhp(a.grossCents)} paid {a.channel === "qr" ? "by QR at the desk" : "online"} · −
                      {formatPhp(a.feeCents ?? 0)} fee
                    </p>
                  )}
                  {a.kind === "cash_fee" && a.grossCents !== null && (
                    <p className="truncate font-mono text-[0.65rem] text-muted-foreground/80">
                      {formatPhp(a.grossCents)} cash kept by you · platform fee deducted here
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className={cn("font-mono text-sm", incoming ? "text-bone" : "text-muted-foreground")}>
                    {incoming ? "+" : "−"}
                    {formatPhp(Math.abs(a.amountCents))}
                  </p>
                  <p className="text-[0.65rem] text-muted-foreground">
                    {a.kind === "withdrawal" && a.status ? (
                      <span className={cn(a.status === "pending" ? "text-brass" : a.status === "rejected" && "text-[#e58a72]")}>
                        {a.status === "pending" ? "In review" : a.status}
                      </span>
                    ) : (
                      new Date(a.createdAt).toLocaleDateString("en-PH", { month: "short", day: "numeric" })
                    )}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {rows.length > limit && (
        <div className="text-center">
          <Button variant="ghost" size="sm" onClick={() => setLimit((n) => n + 20)}>
            Show more
          </Button>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── Withdrawals ─────────────────────────── */

const W_STATUS: Record<string, { label: string; tone: string; icon: typeof Clock }> = {
  pending: { label: "In review", tone: "text-brass", icon: Clock },
  approved: { label: "Sent", tone: "text-bone", icon: Check },
  rejected: { label: "Declined — returned to balance", tone: "text-[#e58a72]", icon: ArrowDownLeft },
  cancelled: { label: "Cancelled", tone: "text-muted-foreground", icon: ArrowDownLeft },
};

export function WithdrawalsList({ withdrawals }: { withdrawals: WithdrawalRow[] }) {
  if (!withdrawals.length) {
    return (
      <p className="rounded-2xl border border-dashed border-line px-5 py-8 text-center text-sm text-muted-foreground">
        No withdrawals yet. When you request one, you can follow it here.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
      {withdrawals.map((w) => {
        const s = W_STATUS[w.status] ?? W_STATUS.pending;
        return (
          <li key={w.id} className="flex items-center gap-3 bg-surface px-4 py-3.5">
            <MethodMark type={w.methodType} className="size-9" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-bone">{w.methodLabel}</p>
              <p className="text-xs text-muted-foreground">Requested {formatDateTime(w.createdAt)}</p>
              {w.note && <p className="mt-0.5 text-xs text-bone/70">“{w.note}”</p>}
            </div>
            <div className="shrink-0 text-right">
              <p className="font-mono text-sm text-bone">{formatPhp(w.amountCents)}</p>
              <p className={cn("flex items-center justify-end gap-1 text-[0.7rem]", s.tone)}>
                <s.icon className="size-3" />
                {s.label}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
