import Link from "next/link";
import { ArrowDownLeft, Banknote, QrCode } from "lucide-react";
import { formatPhp } from "@/lib/format";
import type { WalletOverview } from "@/lib/wallet/overview";

/** Where the balance came from: per event (bars) and per payment channel. */
export function IncomeSources({ overview: o, feePercent }: { overview: WalletOverview; feePercent: number }) {
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

  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <div className="rounded-2xl border border-line bg-surface p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-sm font-semibold text-bone">By event</h3>
          <span className="font-mono text-xs text-muted-foreground">net after {feePercent}% fee</span>
        </div>
        {!o.byEvent.length ? (
          <p className="mt-6 text-sm text-muted-foreground">
            When players pay for your events, each event shows up here with what it earned.
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {o.byEvent.slice(0, 6).map((e, i) => (
              <li key={e.tournamentId}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <Link href={`/tournaments/${e.slug}`} className="min-w-0 truncate text-bone hover:text-brass">
                    {e.name}
                  </Link>
                  <span className="shrink-0 font-mono text-bone">{formatPhp(e.netCents)}</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-ink/60">
                  <div
                    className="h-full origin-left animate-[grow_900ms_cubic-bezier(.2,.8,.2,1)_both] rounded-full bg-gradient-to-r from-umber to-brass"
                    style={{ width: `${Math.max(3, (Math.max(0, e.netCents) / top) * 100)}%`, animationDelay: `${i * 80}ms` }}
                  />
                </div>
                <p className="mt-1 font-mono text-[0.65rem] text-muted-foreground">
                  {e.entries} paid {e.entries === 1 ? "entry" : "entries"} · {formatPhp(e.grossCents)} collected ·{" "}
                  {formatPhp(e.feeCents)} fees
                </p>
              </li>
            ))}
          </ul>
        )}
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
