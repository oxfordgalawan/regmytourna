import Link from "next/link";
import { ArrowUpRight, MapPin, Swords } from "lucide-react";
import { PayNowButton } from "@/components/player/pay-now-button";
import { PartnerLine } from "@/components/player/partner-line";
import { dateTile, formatDateRange, formatPhp } from "@/lib/format";
import { NAV_FORWARD } from "@/lib/nav-transitions";
import type { PlayerEntry } from "@/lib/player/entries";
import { cn } from "@/lib/utils";

/** What the player needs to know about payment, in plain words. */
export function paymentState(e: PlayerEntry) {
  if (e.status === "cancelled") return { label: "Cancelled", tone: "quiet" as const };
  if (e.paymentStatus === "paid") return { label: "Paid · confirmed", tone: "good" as const };
  if (e.entrySource === "pay_at_venue" || e.entrySource === "desk") {
    return { label: `Pay ${formatPhp(e.feeCents)} at the desk`, tone: "warn" as const };
  }
  return { label: `${formatPhp(e.feeCents)} to pay`, tone: "warn" as const };
}

const TONE = {
  good: "bg-umber/50 text-bone border-umber",
  warn: "bg-brass/10 text-brass border-brass/40",
  quiet: "bg-transparent text-muted-foreground border-line",
};

/**
 * An entry, styled as a ticket: event + category on the left, a perforated
 * stub with the date on the right (bottom on phones).
 */
export function EntryTicket({ entry: e, className }: { entry: PlayerEntry; className?: string }) {
  const tile = dateTile(e.tournament.startDate);
  const pay = paymentState(e);
  const canPayOnline = e.paymentStatus !== "paid" && e.status !== "cancelled" && e.entrySource === "online" && e.feeCents > 0;
  const match = e.liveMatch ?? e.nextMatch;

  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-colors duration-300 hover:border-umber sm:flex-row",
        e.status === "cancelled" && "opacity-60",
        className
      )}
    >
      {/* main */}
      <div className="relative min-w-0 flex-1 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("inline-flex h-6 items-center rounded-full border px-2.5 text-xs", TONE[pay.tone])}>
            {pay.label}
          </span>
          {e.played.length > 0 && (
            <span className="font-mono text-xs text-muted-foreground">
              {e.wins}W – {e.losses}L
            </span>
          )}
        </div>
        <Link
          href={`/tournaments/${e.tournament.slug}`}
          transitionTypes={NAV_FORWARD}
          className="mt-3 flex items-start justify-between gap-3"
        >
          <span className="min-w-0">
            <span className="block truncate text-lg font-semibold text-bone group-hover:underline group-hover:decoration-umber group-hover:underline-offset-4">
              {e.tournament.name}
            </span>
            <span className="mt-0.5 block truncate text-sm text-brass">{e.categoryName}</span>
          </span>
          <ArrowUpRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Link>
        {e.partner ? (
          <PartnerLine entry={e} />
        ) : (
          <p className="mt-3 truncate text-sm text-muted-foreground">{e.teamName}</p>
        )}
        {(e.tournament.venueName || e.tournament.city) && (
          <p className="mt-1 flex items-center gap-1.5 truncate text-sm text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" />
            {[e.tournament.venueName, e.tournament.city].filter(Boolean).join(", ")}
          </p>
        )}

        {match && (
          <div
            className={cn(
              "mt-4 flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm",
              e.liveMatch ? "border-rust/50 bg-rust/10" : "border-line bg-ink/30"
            )}
          >
            {e.liveMatch ? (
              <span className="size-2 shrink-0 animate-pulse-dot rounded-full bg-rust" />
            ) : (
              <Swords className="size-4 shrink-0 text-brass" />
            )}
            <span className="min-w-0 flex-1 truncate text-bone">
              {e.liveMatch ? "Playing now" : "Next"} · vs {match.opponent}
            </span>
            <span className="shrink-0 font-mono text-xs text-muted-foreground">
              {match.courtName ?? match.label}
            </span>
          </div>
        )}

        {canPayOnline && (
          <div className="mt-4">
            <PayNowButton registrationId={e.id} label={`Pay ${formatPhp(e.feeCents)}`} />
          </div>
        )}
      </div>

      {/* perforation + stub */}
      <div className="relative flex shrink-0 items-center justify-between gap-4 border-t border-dashed border-line px-5 py-4 sm:w-36 sm:flex-col sm:justify-center sm:border-t-0 sm:border-l sm:py-5 sm:text-center">
        {/* punched notches */}
        <span aria-hidden className="absolute -top-2.5 -left-2.5 size-5 rounded-full border border-line bg-ink sm:-top-2.5 sm:-left-2.5" />
        <span aria-hidden className="absolute -top-2.5 -right-2.5 size-5 rounded-full border border-line bg-ink sm:top-auto sm:-bottom-2.5 sm:-left-2.5 sm:right-auto" />
        <div className="flex items-baseline gap-2 sm:flex-col sm:items-center sm:gap-0">
          <p className="font-mono text-xs tracking-widest text-brass">{tile?.month ?? "TBA"}</p>
          <p className="display text-4xl text-bone sm:text-5xl">{tile?.day ?? "––"}</p>
          {tile && <p className="font-mono text-[0.65rem] text-muted-foreground">{tile.weekday}</p>}
        </div>
        <p className="text-right text-xs text-muted-foreground sm:text-center">
          {formatDateRange(e.tournament.startDate, e.tournament.endDate)}
        </p>
      </div>
    </article>
  );
}
