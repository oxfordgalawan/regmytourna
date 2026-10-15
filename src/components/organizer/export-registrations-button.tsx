"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

function csvCell(value: unknown) {
  const s = value == null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function ExportRegistrationsButton({
  tournamentId,
  registrations,
}: {
  tournamentId: string;
  registrations: Array<Record<string, unknown>>;
}) {
  function exportCsv() {
    const columns = ["id", "player", "emails", "division", "status", "payment_status", "checkedIn"];
    const emailsOf = (r: Record<string, unknown>) =>
      Array.isArray(r.players)
        ? (r.players as Array<{ email: string | null }>).map((p) => p.email).filter(Boolean).join("; ")
        : "";
    const rows = [columns, ...registrations.map((r) => columns.map((c) => (c === "emails" ? emailsOf(r) : r[c])))];
    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `registrations-${tournamentId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button type="button" variant="secondary" size="sm" onClick={exportCsv}>
      <Download />
      Export CSV
    </Button>
  );
}
