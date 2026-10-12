"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { CheckInButton } from "@/components/organizer/check-in-button";
import { ExportRegistrationsButton } from "@/components/organizer/export-registrations-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type RegistrationRow = {
  id: string;
  player: string;
  division: string;
  status: string;
  payment_status: string;
  challonge_sync_status: string | null;
  checkedIn: boolean;
};

const views = [
  { value: "all", label: "All" },
  { value: "unpaid", label: "Unpaid" },
  { value: "to_check_in", label: "Not checked in" },
] as const;

export function RegistrationsTable({
  tournamentId,
  rows,
}: {
  tournamentId: string;
  rows: RegistrationRow[];
}) {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<(typeof views)[number]["value"]>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (view === "unpaid" && r.payment_status === "paid") return false;
      if (view === "to_check_in" && r.checkedIn) return false;
      if (!q) return true;
      return r.player.toLowerCase().includes(q) || r.division.toLowerCase().includes(q);
    });
  }, [rows, query, view]);

  const checkedIn = rows.filter((r) => r.checkedIn).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative w-full sm:w-72">
          <span className="sr-only">Search entries</span>
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search player or division"
            className="h-10 w-full rounded-lg border border-input bg-ink/40 pr-3 pl-10 text-sm text-bone outline-none placeholder:text-muted-foreground hover:border-bone/30 focus-visible:border-brass"
          />
        </label>
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
          {views.map((v) => (
            <button
              key={v.value}
              type="button"
              onClick={() => setView(v.value)}
              aria-pressed={view === v.value}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-sm transition-colors",
                view === v.value
                  ? "border-bone bg-bone text-ink"
                  : "border-line text-muted-foreground hover:border-bone/40 hover:text-bone"
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-4">
          <span className="font-mono text-sm text-muted-foreground">
            {checkedIn}/{rows.length} checked in
          </span>
          <ExportRegistrationsButton tournamentId={tournamentId} registrations={rows} />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5">Player</TableHead>
              <TableHead>Division</TableHead>
              <TableHead>Entry</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Bracket sync</TableHead>
              <TableHead className="pr-5 text-right">Check-in</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="pl-5 font-medium text-bone">{r.player}</TableCell>
                <TableCell className="text-muted-foreground">{r.division}</TableCell>
                <TableCell>
                  <StatusBadge status={r.status} />
                </TableCell>
                <TableCell>
                  <StatusBadge status={r.payment_status} />
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {r.challonge_sync_status ?? "—"}
                </TableCell>
                <TableCell className="pr-5 text-right">
                  <CheckInButton
                    tournamentId={tournamentId}
                    registrationId={r.id}
                    checkedIn={r.checkedIn}
                  />
                </TableCell>
              </TableRow>
            ))}
            {!filtered.length && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  No entries match.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
