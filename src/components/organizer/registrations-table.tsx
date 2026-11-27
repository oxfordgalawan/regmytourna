"use client";

import { startTransition, useDeferredValue, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, Banknote, MailWarning, Search, UserMinus, UserPlus, UserRoundPen, X } from "lucide-react";
import { FeeCorrectionDialog } from "@/components/organizer/fee-correction-dialog";
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
import { MoveEntryDialog, type MoveEntryTarget } from "@/components/organizer/move-entry-dialog";
import { clearPartnerFromEntryAction } from "@/app/actions/organizer-entry-moves";
import { PlayerEmailCell } from "@/components/organizer/player-email-cell";
import { PlayerNameCell } from "@/components/organizer/player-name-cell";
import { PlayerPhoneCell } from "@/components/organizer/player-phone-cell";
import { formatPhp } from "@/lib/format";

export type RegistrationRow = {
  id: string;
  player: string;
  divisionId: string;
  division: string;
  status: string;
  payment_status: string;
  source: "online" | "pay_at_venue" | "desk";
  paidVia: "online" | "cash" | "qr" | null;
  feeCents: number;
  paidCents?: number;
  balanceDueCents?: number;
  checkedIn: boolean;
  partner?: "on_platform" | "invited" | "declined" | "guest" | null;
  players?: Array<{
    rowId: string;
    name: string;
    email: string | null;
    phone: string | null;
    primary: boolean;
    hasAccount: boolean;
  }>;
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
  desk: "Manual",
};
const PAID_LABEL: Record<NonNullable<RegistrationRow["paidVia"]>, string> = {
  online: "Online",
  cash: "Cash",
  qr: "QR",
};

function amountToCollect(r: RegistrationRow): number {
  return r.balanceDueCents ?? Math.max(0, r.feeCents - (r.paidCents ?? 0));
}

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
  const [categoryFilter, setCategoryFilter] = useState<"all" | string>("all");
  const [collect, setCollect] = useState<{ target: CollectTarget; how: "choose" | "cash" | "qr" } | null>(null);
  const [adding, setAdding] = useState(false);
  const [walkIn, setWalkIn] = useState(allowWalkIn);
  const [replacing, setReplacing] = useState<ReplaceTarget | null>(null);
  const [moving, setMoving] = useState<MoveEntryTarget | null>(null);
  const [clearingPartner, setClearingPartner] = useState<string | null>(null);
  const [feeCorrectionOpen, setFeeCorrectionOpen] = useState(false);

  const visible = rows.filter((r) => r.status !== "cancelled");
  // deferred so typing stays snappy and the result swap can animate
  const deferredQuery = useDeferredValue(query);
  const divisionOrder = useMemo(
    () => new Map(categories.map((c, i) => [c.id, i] as const)),
    [categories]
  );
  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    const list = visible.filter((r) => {
      if (categoryFilter !== "all" && r.divisionId !== categoryFilter) return false;
      if (view === "unpaid" && (r.payment_status === "paid" || r.status === "waitlisted")) return false;
      if (view === "to_check_in" && r.checkedIn) return false;
      if (!q) return true;
      return (
        r.player.toLowerCase().includes(q) ||
        r.division.toLowerCase().includes(q) ||
        Boolean(
          r.players?.some(
            (p) => p.email?.toLowerCase().includes(q) || p.phone?.replace(/\D/g, "").includes(q.replace(/\D/g, ""))
          )
        )
      );
    });
    const unknownDivisionRank = categories.length;
    return [...list].sort((a, b) => {
      const ordA = divisionOrder.get(a.divisionId) ?? unknownDivisionRank;
      const ordB = divisionOrder.get(b.divisionId) ?? unknownDivisionRank;
      if (ordA !== ordB) return ordA - ordB;
      return a.player.localeCompare(b.player, undefined, { sensitivity: "base" });
    });
  }, [visible, deferredQuery, view, categoryFilter, divisionOrder, categories.length]);

  const checkedIn = visible.filter((r) => r.checkedIn).length;
  const toCollect = visible.filter((r) => r.payment_status !== "paid");
  const owed = toCollect.reduce((n, r) => n + (r.balanceDueCents ?? r.feeCents), 0);

  async function toggleWalkIn() {
    const next = !walkIn;
    setWalkIn(next);
    const res = await setWalkInPaymentAction(tournamentId, next);
    if (res.error) {
      setWalkIn(!next);
      toast.error(res.error);
    } else toast.success(next ? "Players can now choose to pay at the venue" : "Pay at the venue turned off");
  }

  const movableStatuses = new Set(["confirmed", "awaiting_payment", "pending", "awaiting_partner"]);

  async function clearPartner(r: RegistrationRow) {
    if (
      !window.confirm(
        `Remove the partner from this entry (${r.player})? The slot stays open and will show as needing a partner.`
      )
    ) {
      return;
    }
    setClearingPartner(r.id);
    const res = await clearPartnerFromEntryAction(r.id);
    setClearingPartner(null);
    if (res.error) toast.error(res.error);
    else {
      toast.success("Partner removed — slot open for a new partner");
      router.refresh();
    }
  }

  async function cancel(r: RegistrationRow) {
    const paid = r.payment_status === "paid" && r.status !== "waitlisted";
    const message = paid
      ? `Remove ${r.player} from ${r.division}?\n\nTheir slot is freed and your wallet is adjusted for this payment. You must refund the player off-platform (not through RegMyTourna).`
      : `Cancel ${r.player}'s entry? Their slot in ${r.division} is freed.`;
    if (!window.confirm(message)) return;
    const res = await cancelEntryAction(r.id);
    if (res.error) return toast.error(res.error);
    toast.success(paid ? "Entry removed" : "Entry cancelled");
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
          <Button variant="outline" onClick={() => setFeeCorrectionOpen(true)}>
            <MailWarning />
            Request balance payments
          </Button>
          <Button onClick={() => setAdding(true)} disabled={!categories.length}>
            <UserPlus />
            Add players manually
          </Button>
        </div>
      </div>

      <FeeCorrectionDialog
        tournamentId={tournamentId}
        open={feeCorrectionOpen}
        onOpenChange={setFeeCorrectionOpen}
        onApplied={() => router.refresh()}
      />

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
          <ExportRegistrationsButton tournamentId={tournamentId} registrations={filtered} />
        </div>
      </div>

      {categories.length > 0 && (
        <FilterChips
          label="Category"
          className="max-w-full pb-1"
          chips={[
            {
              key: "all",
              label: "All categories",
              active: categoryFilter === "all",
              onSelect: () => startTransition(() => setCategoryFilter("all")),
            },
            ...categories.map((c) => {
              const count = visible.filter((r) => r.divisionId === c.id).length;
              return {
                key: c.id,
                label: count > 0 ? `${c.name} · ${count}` : c.name,
                active: categoryFilter === c.id,
                onSelect: () => startTransition(() => setCategoryFilter(c.id)),
              };
            }),
          ]}
        />
      )}

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
              const movable = movableStatuses.has(r.status);
              const moveButton = movable ? (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() =>
                    setMoving({
                      registrationId: r.id,
                      divisionId: r.divisionId,
                      divisionName: r.division,
                      doubles: Boolean(r.doubles),
                      players: (r.players ?? []).map((p) => ({
                        rowId: p.rowId,
                        name: p.name,
                        primary: p.primary,
                      })),
                    })
                  }
                  aria-label={`Move ${r.player} to another category`}
                  title="Move to another category"
                >
                  <ArrowRightLeft />
                </Button>
              ) : null;
              const clearPartnerButton =
                movable && r.doubles && (r.players?.length ?? 0) >= 2 && !r.needsPartner ? (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    disabled={clearingPartner === r.id}
                    onClick={() => clearPartner(r)}
                    aria-label={`Clear partner on ${r.player}`}
                    title="Clear partner slot"
                  >
                    <UserMinus />
                  </Button>
                ) : null;
              return (
                <TableRow key={r.id}>
                  <TableCell className="pl-5">
                    {r.players?.length ? (
                      <span className="block space-y-1.5">
                        {r.players.map((p) => (
                          <span key={p.rowId} className="block min-w-0">
                            {p.hasAccount ? (
                              <span className="block font-medium text-bone">{p.name}</span>
                            ) : (
                              <PlayerNameCell registrationId={r.id} rowId={p.rowId} name={p.name} />
                            )}
                            <PlayerEmailCell
                              key={`${p.rowId}-${p.email ?? ""}`}
                              registrationId={r.id}
                              rowId={p.rowId}
                              email={p.email}
                              hasAccount={p.hasAccount}
                              partner={!p.primary}
                            />
                            <PlayerPhoneCell
                              registrationId={r.id}
                              rowId={p.rowId}
                              phone={p.phone}
                              hasAccount={p.hasAccount}
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
                    {unpaid && amountToCollect(r) > 0 ? (
                      <span className="flex flex-col items-start gap-1">
                        <span className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="umber"
                          onClick={() =>
                            setCollect({
                              target: {
                                id: r.id,
                                player: r.player,
                                division: r.division,
                                feeCents: amountToCollect(r),
                              },
                              how: "choose",
                            })
                          }
                        >
                          <Banknote />
                          Collect {formatPhp(amountToCollect(r))}
                        </Button>
                        {replaceButton}
                        {moveButton}
                        {clearPartnerButton}
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
                        {r.payment_status === "partial" && (r.paidCents ?? 0) > 0 ? (
                          <span className="flex flex-wrap items-center gap-2 pl-0.5">
                            <StatusBadge status="partial" />
                            <span className="font-mono text-[0.65rem] text-muted-foreground">
                              Paid {formatPhp(r.paidCents ?? 0)} · due {formatPhp(amountToCollect(r))}
                            </span>
                          </span>
                        ) : null}
                      </span>
                    ) : r.status === "waitlisted" ? (
                      <span className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">Pays once moved into a slot</span>
                        {replaceButton}
                        {moveButton}
                        {clearPartnerButton}
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
                      <span className="flex items-center gap-1">
                        <StatusBadge status={r.payment_status} />
                        {r.paidVia && r.paidVia !== "online" && (
                          <span className="font-mono text-[0.65rem] text-muted-foreground">{PAID_LABEL[r.paidVia]}</span>
                        )}
                        {replaceButton}
                        {moveButton}
                        {clearPartnerButton}
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => cancel(r)}
                          aria-label={`Remove ${r.player}'s entry`}
                          title="Remove entry and free their slot"
                        >
                          <X />
                        </Button>
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
                  {!visible.length
                    ? "No entries yet. Online registrations and manual entries appear here."
                    : categoryFilter !== "all"
                      ? "No entries in this category."
                      : "No entries match."}
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
      {moving && (
        <MoveEntryDialog key={moving.registrationId} categories={categories} target={moving} onClose={() => setMoving(null)} />
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
