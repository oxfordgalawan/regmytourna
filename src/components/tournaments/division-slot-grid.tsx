"use client";

import { Clock, Lock, Plus } from "lucide-react";
import { PlayerAvatar } from "@/components/players/player-avatar";
import { PaymentHoldTimer } from "@/components/tournaments/payment-hold-timer";
import type { PublicRosterEntry } from "@/lib/registrations/public-roster";
import { cn } from "@/lib/utils";

function entryMatches(entry: PublicRosterEntry, query: string) {
  if (!query) return true;
  return entry.players.some((p) => p.name.toLowerCase().includes(query));
}

export function DivisionSlotGrid({
  capacity,
  entries,
  registrationOpen,
  categoryFull = false,
  searchQuery = "",
  onClaimSlot,
  onHoldExpire,
}: {
  capacity: number;
  entries: PublicRosterEntry[];
  registrationOpen: boolean;
  categoryFull?: boolean;
  searchQuery?: string;
  onClaimSlot: () => void;
  onHoldExpire?: () => void;
}) {
  const q = searchQuery.trim().toLowerCase();
  const showAvailable = !q;

  return (
    <ul className="grid gap-2 sm:grid-cols-2" role="list" aria-label="Entry slots">
      {Array.from({ length: capacity }, (_, index) => {
        const slotNumber = index + 1;
        const entry = entries[index];
        const occupied = Boolean(entry);

        if (occupied) {
          if (entry.paymentHold?.expiresAt) {
            return (
              <li
                key={`slot-${slotNumber}`}
                className="relative flex min-h-[5.5rem] flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-line/80 bg-ink/25 p-3 text-center"
              >
                <span className="absolute top-2 right-2 font-mono text-[0.65rem] tracking-widest text-muted-foreground/70">
                  {String(slotNumber).padStart(2, "0")}
                </span>
                <span className="flex items-center gap-1.5 text-sm font-medium text-bone/85">
                  <Clock className="size-3.5 text-brass" aria-hidden />
                  Reserved
                </span>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  Pay pending ·{" "}
                  <PaymentHoldTimer expiresAt={entry.paymentHold.expiresAt} onExpire={onHoldExpire} />
                </span>
              </li>
            );
          }
          if (q && !entryMatches(entry, q)) return null;
          if (!entry.players.length) return null;
          const [a, b] = entry.players;
          return (
            <li
              key={`slot-${slotNumber}`}
              className="relative flex min-h-[5.5rem] items-center gap-3 rounded-2xl border border-line bg-surface p-3"
            >
              <span className="absolute top-2 right-2 font-mono text-[0.65rem] tracking-widest text-muted-foreground/70">
                {String(slotNumber).padStart(2, "0")}
              </span>
              <div className="flex shrink-0 -space-x-2">
                <PlayerAvatar name={a.name} src={a.avatarUrl} className="size-10 text-sm" />
                {b && <PlayerAvatar name={b.name} src={b.avatarUrl} className="size-10 text-sm" />}
              </div>
              <div className="min-w-0 pr-6">
                <p className="truncate text-sm font-semibold text-bone">{a.name}</p>
                {b && (
                  <p className="truncate text-xs text-bone/75">
                    <span className="text-brass">&amp;</span> {b.name}
                  </p>
                )}
              </div>
            </li>
          );
        }

        if (!showAvailable) return null;

        const canClaim = registrationOpen && !categoryFull;
        const closed = !registrationOpen;
        return (
          <li key={`slot-${slotNumber}`}>
            <button
              type="button"
              title={canClaim ? "Register for this slot" : closed ? "Registration is not open yet" : "Category is full"}
              onClick={() => onClaimSlot()}
              className={cn(
                "flex min-h-[5.5rem] w-full flex-col items-center justify-center gap-1 rounded-2xl border border-dashed p-3 text-center transition-colors",
                canClaim
                  ? "cursor-pointer border-line bg-ink/20 text-muted-foreground hover:border-brass hover:bg-brass/[0.06] hover:text-bone"
                  : closed
                    ? "cursor-pointer border-line/70 bg-ink/15 text-muted-foreground hover:border-umber/60 hover:bg-ink/25"
                    : "cursor-not-allowed border-line/60 bg-ink/10 opacity-70"
              )}
            >
              <span className="font-mono text-xs text-brass">{String(slotNumber).padStart(2, "0")}</span>
              <span className="flex items-center gap-1.5 text-sm font-medium">
                {canClaim && <Plus className="size-4 text-brass" aria-hidden />}
                {closed && <Lock className="size-3.5 text-muted-foreground" aria-hidden />}
                {canClaim ? "Available" : closed ? "Not open yet" : "Full"}
              </span>
              {canClaim && <span className="text-xs text-muted-foreground">Tap to register</span>}
              {closed && <span className="text-xs text-muted-foreground">Tap for details</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}