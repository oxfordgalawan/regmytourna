"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestWalletWithdrawal } from "@/app/actions/withdrawals";
import { formatPhp } from "@/lib/format";
import type { PayoutMethodType } from "@/lib/payout-methods/config";

type MethodOption = { id: string; label: string; method_type: PayoutMethodType; is_default: boolean };
type WithdrawalRow = {
  id: string;
  amount_cents: number;
  status: string;
  created_at: string;
};

export function WithdrawalRequestPanel({
  methods,
  availableCents,
  minWithdrawalCents,
  pendingRequests,
}: {
  methods: MethodOption[];
  availableCents: number;
  minWithdrawalCents: number;
  pendingRequests: WithdrawalRow[];
}) {
  const [loading, setLoading] = useState(false);
  const defaultId = methods.find((m) => m.is_default)?.id ?? methods[0]?.id ?? "";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!methods.length) {
      toast.error("Add a payout method first.");
      return;
    }
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const pesos = Number(fd.get("amountPesos"));
    const amountCents = Math.round(pesos * 100);
    const payoutMethodId = String(fd.get("payoutMethodId") ?? defaultId);

    const result = await requestWalletWithdrawal({ amountCents, payoutMethodId });
    setLoading(false);
    if (result.error) toast.error(result.error);
    else {
      toast.success("Withdrawal submitted for admin approval");
      (e.target as HTMLFormElement).reset();
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} className="grid max-w-md gap-4">
        <div className="space-y-2">
          <Label htmlFor="amountPesos">Amount (PHP)</Label>
          <Input
            id="amountPesos"
            name="amountPesos"
            type="number"
            min={minWithdrawalCents / 100}
            step="0.01"
            max={availableCents / 100}
            placeholder={(minWithdrawalCents / 100).toFixed(2)}
            required
            disabled={!methods.length || availableCents < minWithdrawalCents}
          />
          <p className="text-xs text-muted-foreground">
            Available {formatPhp(availableCents)} · Min {formatPhp(minWithdrawalCents)}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="payoutMethodId">Payout to</Label>
          <select
            id="payoutMethodId"
            name="payoutMethodId"
            defaultValue={defaultId}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
            disabled={!methods.length}
            required
          >
            {methods.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" disabled={loading || !methods.length}>
          {loading && <Loader2 className="animate-spin" />}
          Request withdrawal
        </Button>
        <p className="text-xs text-muted-foreground">
          Requests are reviewed by platform admin. Funds are held until approved or rejected.
        </p>
      </form>

      {pendingRequests.length > 0 && (
        <div>
          <p className="eyebrow mb-2">Pending approval</p>
          <ul className="divide-y divide-line rounded-xl border border-line">
            {pendingRequests.map((r) => (
              <li key={r.id} className="flex justify-between bg-surface px-4 py-2 text-sm">
                <span className="text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
                <span className="font-mono text-bone">{formatPhp(r.amount_cents)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
