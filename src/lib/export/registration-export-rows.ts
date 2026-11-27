import { formatPhp } from "@/lib/format";

export type ExportRegistrationRow = {
  player: string;
  divisionId: string;
  status: string;
  payment_status: string;
  feeCents: number;
  paidCents?: number;
  balanceDueCents?: number;
  checkedIn: boolean;
  players?: Array<{ email: string | null }>;
};

export type ExportCategory = { id: string; name: string };

export const REGISTRATION_EXPORT_HEADERS = [
  "Player",
  "Email(s)",
  "Entry status",
  "Payment",
  "Fee",
  "Paid",
  "Balance due",
  "Checked in",
] as const;

export function emailsOf(r: ExportRegistrationRow): string {
  return (r.players ?? []).map((p) => p.email).filter(Boolean).join("; ");
}

export function balanceDue(r: ExportRegistrationRow): number {
  const paid = r.paidCents ?? 0;
  return r.balanceDueCents ?? Math.max(0, r.feeCents - paid);
}

export function paymentBucket(r: ExportRegistrationRow): "Paid" | "Partial" | "Unpaid" {
  if (r.status === "waitlisted") return "Unpaid";
  const due = balanceDue(r);
  const paid = r.paidCents ?? 0;
  if (due === 0 && paid > 0 && r.feeCents > 0) return "Paid";
  if (r.payment_status === "paid") return "Paid";
  if (r.payment_status === "partial" || (paid > 0 && due > 0)) return "Partial";
  if (paid > 0 && due === 0) return "Paid";
  return "Unpaid";
}

export function rowToExportCells(r: ExportRegistrationRow, formatMoney: (cents: number) => string = formatPhp): string[] {
  const paid = r.paidCents ?? 0;
  const due = balanceDue(r);
  return [
    r.player,
    emailsOf(r),
    r.status,
    paymentBucket(r),
    formatMoney(r.feeCents),
    formatMoney(paid),
    formatMoney(due),
    r.checkedIn ? "Yes" : "No",
  ];
}

export function groupRowsByDivision(rows: ExportRegistrationRow[]): Map<string, ExportRegistrationRow[]> {
  const byDivision = new Map<string, ExportRegistrationRow[]>();
  for (const r of rows) {
    const list = byDivision.get(r.divisionId) ?? [];
    list.push(r);
    byDivision.set(r.divisionId, list);
  }
  return byDivision;
}