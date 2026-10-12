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
    const columns = ["id", "player", "division", "status", "payment_status", "checkedIn"];
    const rows = [columns, ...registrations.map((r) => columns.map((c) => r[c]))];
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
