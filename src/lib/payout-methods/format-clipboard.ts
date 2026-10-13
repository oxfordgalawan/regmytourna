import { methodTypeLabel, type PayoutMethodSnapshot } from "@/lib/payout-methods/config";

export function formatPayoutMethodForCopy(snapshot: PayoutMethodSnapshot): string {
  const lines = [
    `Method: ${methodTypeLabel(snapshot.method_type)}`,
    `Label: ${snapshot.label}`,
    `Account name: ${snapshot.account_name}`,
    `Account number: ${snapshot.account_number}`,
  ];
  if (snapshot.bank_name?.trim()) {
    lines.push(`Bank: ${snapshot.bank_name.trim()}`);
  }
  if (snapshot.notes?.trim()) {
    lines.push(`Notes: ${snapshot.notes.trim()}`);
  }
  return lines.join("\n");
}
