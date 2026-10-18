"use client";

import { startTransition, useDeferredValue, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote, Search, UserPlus, UserRoundPen, X } from "lucide-react";
import { toast } from "@/lib/ui/app-toast";
import { cn } from "@/lib/utils";
import { cancelEntryAction, setWalkInPaymentAction } from "@/app/actions/walk-in";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { CheckInButton } from "@/components/organizer/check-in-button";
import { ExportRegistrationsButton } from "@/components/organizer/export-registrations-button";
import {
  AddWalkInDialog,
  CollectPaymentDialog,
  type CollectTarget,
  type WalkInCategory,
} from "@/components/organizer/walk-in-dialogs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FilterChips } from "@/components/ui/filter-chips";
import { ReplacePlayerDialog, type ReplaceTarget } from "@/components/organizer/replace-player-dialog";
import { PlayerEmailCell } from "@/components/organizer/player-email-cell";
import { formatPhp } from "@/lib/format";

export type RegistrationRow = {
  id: string;
  player: string;
  division: string;
  status: string;
  payment_status: string;
  source: "online" | "pay_at_venue" | "desk";
  paidVia: "online" | "cash" | "qr" | null;
  feeCents: number;
  checkedIn: boolean;
  partner?: "on_platform" | "invited" | "declined" | "guest" | null;
  players?: Array<{ rowId: string; name: string; email: string | null; primary: boolean; hasAccount: boolean }>;
  doubles?: boolean;
  needsPartner?: boolean;
  substitutePending?: boolean;
};

const views = [
  { value: "all", label: "All" },
  { value: "unpaid", label: "To collect" },
  { value: "to_check_in", label: "Not checked in" },
] as const;

const PARTNER_LABEL = {
  on_platform: "Partner on RegMyTourna",
  invited: "Partner invited",
  declined: "Partner said not me",
  guest: "Partner not on platform",
} as const;

const SOURCE_LABEL: Record<RegistrationRow["source"], string> = {
  online: "Online",
  pay_at_venue: "Pays at venue",
  desk: "Walk-in",
};
const PAID_LABEL: Record<NonNullable<RegistrationRow["paidVia"]>, string> = {
  online: "Online",
  cash: "Cash",
  qr: "QR",
};

export function RegistrationsTable({
  tournamentId,
  rows,
  categories,
  allowWalkIn,
}: {
  tournamentId: string;
  rows: RegistrationRow[];
  categories: WalkInCategory[];
  allowWalkIn: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [view, setView] = useState<(typeof views)[number]["value"]>("all");
  const [collect, setCollect] = useState<{ target: CollectTarget; how: "choose" | "cash" | "qr" } | null>(null);
  const [adding, setAdding] = useState(false);
  const [walkIn, setWalkIn] = useState(allowWalkIn);
  const [replacing, setReplacing] = useState<ReplaceTarget | null>(null);

  const visible = rows.filter((r) => r.status !== "cancelled");
  // deferred so typing stays snappy and the result swap can animate
  const deferredQuery = useDeferredValue(query);
  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    return visible.filter((r) => {
      if (view === "unpaid" && (r.payment_status === "paid" || r.status === "waitlisted")) return false;
      if (view === "to_check_in" && r.checkedIn) return false;
      if (!q) return true;
      return (
        r.player.toLowerCase().includes(q) ||
        r.division.toLowerCase().includes(q) ||
        Boolean(r.players?.some((p) => p.email?.toLowerCase().includes(q)))
      );
    });
  }, [visible, deferredQuery, view]);

  const checkedIn = visible.filter((r) => r.checkedIn).length;
  const toCollect = visible.filter((r) => r.payment_status !== "paid");
  const owed = toCollect.reduce((n, r) => n + r.feeCents, 0);

  async function toggleWalkIn() {
    const next = !walkIn;
    setWalkIn(next);
    const res = await setWalkInPaymentAction(tournamentId, next);
    if (res.error) {
      setWalkIn(!next);
      toast.error(res.error);
    } else toast.success(next ? "Players can now choose to pay at the venue" : "Pay at the venue turned off");
  }

  async function cancel(r: RegistrationRow) {
    if (!window.confirm(`Cancel ${r.player}'s entry? Their slot in ${r.division} is freed.`)) return;
    const res = await cancelEntryAction(r.id);
    if (res.error) return toast.error(res.error);
    toast.success("Entry cancelled");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* Desk tools */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4">
        <label className="flex cursor-pointer items-center gap-3">
          <span className="relative inline-flex shrink-0">
            <input type="checkbox" checked={walkIn} onChange={toggleWalkIn} className="peer sr-only" />
            <span className="h-6 w-11 rounded-full bg-surface-2 ring-1 ring-line transition-colors peer-checked:bg-bone peer-focus-visible:ring-2 peer-focus-visible:ring-brass" />
            <span className="absolute top-1 left-1 size-4 rounded-full bg-bone/70 transition-all peer-checked:translate-x-5 peer-checked:bg-ink" />
          </span>
          <span>
            <span className="block text-sm font-medium text-bone">Allow pay at the venue</span>
            <span className="block text-xs text-muted-foreground">Players can register online and pay in cash or QR on the day.</span>
          </span>
        </label>
        <div className="flex items-center gap-3">
          {toCollect.length > 0 && (
            <span className="font-mono text-xs text-brass">
              {toCollect.length} to collect · {formatPhp(owed)}
            </span>
          )}
          <Button onClick={() => setAdding(true)} disabled={!categories.length}>
            <UserPlus />
            Add walk-in
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="relative w-full sm:w-72">
          <span className="sr-only">Search entries</span>
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search player or category"
            className="h-10 w-full rounded-lg border border-input bg-ink/40 pr-3 pl-10 text-sm text-bone outline-none placeholder:text-muted-foreground hover:border-bone/30 focus-visible:border-brass"
          />
        </label>
        <FilterChips
          label="Show"
          chips={views.map((v) => ({
            key: v.value,
            label: v.label,
            active: view === v.value,
            // a transition lets the table crossfade instead of snapping
            onSelect: () => startTransition(() => setView(v.value)),
          }))}
        />
        <div className="ml-auto flex items-center gap-4">
          <span className="font-mono text-sm text-muted-foreground">
            {checkedIn}/{visible.length} checked in
          </span>
          <ExportRegistrationsButton tournamentId={tournamentId} registrations={visible} />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5">Players</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Entry</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead className="pr-5 text-right">Check-in</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r) => {
              const unpaid = r.payment_status !== "paid" && r.status !== "waitlisted";
              const canReplace = Boolean(r.players?.length) && (r.source === "desk" || (r.doubles && r.players!.length > 1));
              const replaceButton = canReplace ? (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() =>
                    setReplacing({
                      registrationId: r.id,
                      division: r.division,
                      walkIn: r.source === "desk",
                      players: r.players!,
                    })
                  }
                  aria-label={r.source === "desk" ? `Replace a player on ${r.player}` : `Replace ${r.player}'s partner`}
                  title={r.source === "desk" ? "Replace a player" : "Replace partner"}
                >
                  <UserRoundPen />
                </Button>
              ) : null;
              return (
                <TableRow key={r.id}>
                  <TableCell className="pl-5">
                    {r.players?.length ? (
                      <span className="block space-y-1.5">
                        {r.players.map((p) => (
                          <span key={p.rowId} className="block min-w-0">
                            <span className="block font-medium text-bone">{p.name}</span>
                            <PlayerEmailCell
                              key={`${p.rowId}-${p.email ?? ""}`}
                              registrationId={r.id}
                              rowId={p.rowId}
                              email={p.email}
                              hasAccount={p.hasAccount}
                              partner={!p.primary}
                            />
                          </span>
                        ))}
                      </span>
                    ) : (
                      <span className="block font-medium text-bone">{r.player}</span>
                    )}
                    <span className="mt-1.5 flex flex-wrap gap-x-3">
                      {r.needsPartner && (
                        <span className="font-mono text-[0.65rem] font-semibold text-[#e58a72]">Needs partner</span>
                      )}
                      {r.substitutePending && (
                        <span className="font-mono text-[0.65rem] text-brass">Substitute pending</span>
                      )}
                      {r.source !== "online" && (
                        <span className="font-mono text-[0.65rem] text-muted-foreground">{SOURCE_LABEL[r.source]}</span>
                      )}
                      {r.partner && (
                        <span
                          className={cn(
                            "font-mono text-[0.65rem]",
                            r.partner === "on_platform"
                              ? "text-brass"
                              : r.partner === "declined"
                                ? "text-[#e58a72]"
                                : "text-muted-foreground"
                          )}
                        >
                          {PARTNER_LABEL[r.partner]}
                        </span>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{r.division}</TableCell>
                  <TableCell>
                    <StatusBadge status={r.status} />
                  </TableCell>
                  <TableCell>
                    {unpaid && r.feeCents > 0 ? (
                      <span className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="umber"
                          onClick={() =>
                            setCollect({
                              target: { id: r.id, player: r.player, division: r.division, feeCents: r.feeCents },
                              how: "choose",
                            })
                          }
                        >
                          <Banknote />
                          Collect {formatPhp(r.feeCents)}
                        </Button>
                        {replaceButton}
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => cancel(r)}
                          aria-label={`Cancel ${r.player}'s entry`}
                          title="Cancel entry (no-show)"
                        >
                          <X />
                        </Button>
                      </span>
                    ) : r.status === "waitlisted" ? (
                      <span className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">Pays once moved into a slot</span>
                        {replaceButton}
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => cancel(r)}
                          aria-label={`Remove ${r.player} from the waitlist`}
                          title="Remove from waitlist"
                        >
                          <X />
                        </Button>
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <StatusBadge status={r.payment_status} />
                        {r.paidVia && r.paidVia !== "online" && (
                          <span className="font-mono text-[0.65rem] text-muted-foreground">{PAID_LABEL[r.paidVia]}</span>
                        )}
                        {replaceButton}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="pr-5 text-right">
                    <CheckInButton tournamentId={tournamentId} registrationId={r.id} checkedIn={r.checkedIn} />
                  </TableCell>
                </TableRow>
              );
            })}
            {!filtered.length && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  {visible.length ? "No entries match." : "No entries yet. Online registrations and walk-ins appear here."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <AddWalkInDialog
        tournamentId={tournamentId}
        categories={categories}
        open={adding}
        onClose={() => setAdding(false)}
        onCollect={(target, how) => setCollect({ target, how })}
      />
      {replacing && (
        <ReplacePlayerDialog key={replacing.registrationId} target={replacing} onClose={() => setReplacing(null)} />
      )}
      {collect && (
        <CollectPaymentDialog
          key={collect.target.id + collect.how}
          target={collect.target}
          startWith={collect.how}
          onClose={() => setCollect(null)}
        />
      )}
    </div>
  );
}
