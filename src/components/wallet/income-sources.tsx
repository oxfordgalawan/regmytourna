import { ArrowDownLeft, Banknote, QrCode } from "lucide-react";
import { formatPhp } from "@/lib/format";
import type { WalletOverview } from "@/lib/wallet/overview";
import { IncomeByEventAccordion } from "@/components/wallet/income-by-event-accordion";

/** Where the balance came from: per event (bars) and per payment channel. */
export function IncomeSources({
  overview: o,
  feePercent,
  settlementDisplay,
}: {
  overview: WalletOverview;
  feePercent: number;
  settlementDisplay: boolean;
}) {
  const top = Math.max(1, ...o.byEvent.map((e) => Math.abs(e.netCents)));
  const channels = [
    { key: "online", icon: ArrowDownLeft, label: "Online payments", hint: "GCash, Maya, cards", cents: o.channels.online },
    { key: "qr", icon: QrCode, label: "QR at the desk", hint: "Scanned on event day", cents: o.channels.qr },
    {
      key: "cash",
      icon: Banknote,
      label: "Cash entries",
      hint: "You kept the cash; we deduct the fee",
      cents: o.channels.cashFees,
    },
  ];

  const eventSubtitle = settlementDisplay
    ? "PayMongo ~1.495% processing (0% convenience fee)"
    : `net after ${feePercent}% fee`;

  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <div className="rounded-2xl border border-line bg-surface p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-sm font-semibold text-bone">By event</h3>
          <span className="font-mono text-xs text-muted-foreground">{eventSubtitle}</span>
        </div>
        <IncomeByEventAccordion
          events={o.byEvent.slice(0, 6)}
          settlementDisplay={settlementDisplay}
          topNetCents={top}
        />
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl border border-line bg-surface p-5">
          <h3 className="text-sm font-semibold text-bone">By payment type</h3>
          <ul className="mt-4 space-y-3">
            {channels.map((c) => (
              <li key={c.key} className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-umber/40 text-brass">
                  <c.icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-bone">{c.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">{c.hint}</span>
                </span>
                <span className={c.cents < 0 ? "font-mono text-sm text-muted-foreground" : "font-mono text-sm text-bone"}>
                  {c.cents < 0 ? "−" : ""}
                  {formatPhp(Math.abs(c.cents))}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line">
          <div className="bg-surface p-4">
            <p className="text-xs text-muted-foreground">Lifetime earned</p>
            <p className="mt-1 font-mono text-lg text-bone">{formatPhp(o.lifetimeNetCents)}</p>
          </div>
          <div className="bg-surface p-4">
            <p className="text-xs text-muted-foreground">Still to collect</p>
            <p className="mt-1 font-mono text-lg text-bone">{formatPhp(o.toCollectCents)}</p>
            <p className="text-[0.65rem] text-muted-foreground">
              {o.toCollectCount} unpaid {o.toCollectCount === 1 ? "entry" : "entries"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}