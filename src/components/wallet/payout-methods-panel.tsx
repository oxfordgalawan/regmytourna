"use client";

import { useState } from "react";
import { Copy, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  PH_BANKS,
  PAYOUT_METHOD_TYPES,
  maskAccountNumber,
  methodTypeLabel,
  type PayoutMethodType,
} from "@/lib/payout-methods/config";
import { formatPayoutMethodForCopy } from "@/lib/payout-methods/format-clipboard";
import { deletePayoutMethod, savePayoutMethod } from "@/app/actions/payout-methods";

type MethodRow = {
  id: string;
  label: string;
  method_type: PayoutMethodType;
  account_name: string;
  account_number: string;
  bank_name: string | null;
  notes: string | null;
  is_default: boolean;
};

export function PayoutMethodsPanel({ methods }: { methods: MethodRow[] }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [methodType, setMethodType] = useState<PayoutMethodType>("gcash");
  const config = PAYOUT_METHOD_TYPES.find((t) => t.value === methodType)!;

  async function copyMethod(m: MethodRow) {
    const text = formatPayoutMethodForCopy({
      label: m.label,
      method_type: m.method_type,
      account_name: m.account_name,
      account_number: m.account_number,
      bank_name: m.bank_name,
      notes: m.notes,
    });
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Payout details copied");
    } catch {
      toast.error("Could not copy");
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const result = await savePayoutMethod({
      label: String(fd.get("label") ?? ""),
      methodType,
      accountName: String(fd.get("accountName") ?? ""),
      accountNumber: String(fd.get("accountNumber") ?? ""),
      bankName: String(fd.get("bankName") ?? ""),
      notes: String(fd.get("notes") ?? ""),
      isDefault: fd.get("isDefault") === "on",
    });
    setSaving(false);
    if (result.error) toast.error(result.error);
    else {
      toast.success("Payout method saved");
      setOpen(false);
    }
  }

  async function onDelete(id: string) {
    const result = await deletePayoutMethod(id);
    if (result.error) toast.error(result.error);
    else toast.success("Removed");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">Save up to 3 methods for withdrawals.</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={methods.length >= 3}
            onClick={() => setOpen(true)}
          >
            <Plus />
            Add method
          </Button>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add payout method</DialogTitle>
            </DialogHeader>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="methodType">Type</Label>
                <select
                  id="methodType"
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
                  value={methodType}
                  onChange={(e) => setMethodType(e.target.value as PayoutMethodType)}
                >
                  {PAYOUT_METHOD_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="label">Label</Label>
                <Input id="label" name="label" placeholder="My GCash" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accountName">Account name</Label>
                <Input id="accountName" name="accountName" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accountNumber">{config.numberLabel}</Label>
                <Input id="accountNumber" name="accountNumber" placeholder={config.placeholder} required />
                <p className="text-xs text-muted-foreground">{config.hint}</p>
              </div>
              {config.requiresBank && (
                <div className="space-y-2">
                  <Label htmlFor="bankName">Bank</Label>
                  <select
                    id="bankName"
                    name="bankName"
                    className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
                    required
                  >
                    <option value="">Select bank</option>
                    {PH_BANKS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {methodType === "other" && (
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Input id="notes" name="notes" placeholder="How to send payment" />
                </div>
              )}
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="isDefault" className="rounded border-line" />
                Set as default
              </label>
              <Button type="submit" disabled={saving} className="w-full">
                {saving && <Loader2 className="animate-spin" />}
                Save method
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      {!methods.length ? (
        <p className="rounded-xl border border-dashed border-line px-4 py-6 text-sm text-muted-foreground">
          No payout methods yet. Add one before requesting a withdrawal.
        </p>
      ) : (
        <ul className="divide-y divide-line rounded-2xl border border-line">
          {methods.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 bg-surface px-4 py-3">
              <div>
                <p className="font-medium text-bone">
                  {m.label}
                  {m.is_default && (
                    <span className="ml-2 font-mono text-[0.65rem] uppercase text-brass">Default</span>
                  )}
                </p>
                <p className="text-sm text-muted-foreground">
                  {methodTypeLabel(m.method_type)} · {m.account_name} ·{" "}
                  {maskAccountNumber(m.method_type, m.account_number)}
                </p>
              </div>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="ghost" onClick={() => copyMethod(m)}>
                  <Copy />
                  Copy all
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => onDelete(m.id)}>
                  <Trash2 />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
