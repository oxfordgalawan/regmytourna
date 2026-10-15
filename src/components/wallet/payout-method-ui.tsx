import { Landmark, Wallet } from "lucide-react";
import { maskAccountNumber, methodTypeLabel, type PayoutMethodType } from "@/lib/payout-methods/config";
import { cn } from "@/lib/utils";

/** Small mark for a payout method type — a letter tile for e-wallets, an icon otherwise. */
export function MethodMark({ type, className }: { type: PayoutMethodType | null; className?: string }) {
  const base = "flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold";
  if (type === "gcash") return <span className={cn(base, "bg-[#0a3d91] text-white", className)}>G</span>;
  if (type === "maya") return <span className={cn(base, "bg-[#0b5e3c] text-white", className)}>M</span>;
  if (type === "bank")
    return (
      <span className={cn(base, "bg-umber text-bone", className)}>
        <Landmark className="size-5" />
      </span>
    );
  return (
    <span className={cn(base, "bg-surface-2 text-bone ring-1 ring-line", className)}>
      <Wallet className="size-5" />
    </span>
  );
}

export function methodSummary(m: { method_type: PayoutMethodType; account_number: string; bank_name: string | null }) {
  const name = m.method_type === "bank" ? m.bank_name || "Bank" : methodTypeLabel(m.method_type);
  return `${name} · ${maskAccountNumber(m.method_type, m.account_number)}`;
}
