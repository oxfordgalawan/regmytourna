"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { Copy, Download, Loader2, Plus, RefreshCw, UserMinus } from "lucide-react";
import { toast } from "sonner";
import {
  createUmpireAction,
  regenerateUmpirePinAction,
  resetUmpireAccessAction,
  clearPoolUmpireAction,
  setPoolUmpireAction,
  setUmpireActiveAction,
} from "@/app/actions/umpire";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type RosterUmpire = {
  id: string;
  name: string;
  active: boolean;
  gamesCompleted: number;
  gamesWalkover: number;
};

export type PoolRow = {
  divisionId: string;
  divisionName: string;
  pool: string;
  umpireId: string | null;
};

export function UmpireRosterPanel({
  tournamentId,
  umpireUrl,
  umpires,
  pools,
}: {
  tournamentId: string;
  umpireUrl: string;
  umpires: RosterUmpire[];
  pools: PoolRow[];
}) {
  const router = useRouter();
  const [qr, setQr] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const portalOn = umpires.some((u) => u.active);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(umpireUrl, { width: 240, margin: 2, color: { dark: "#000000", light: "#ffffff" } })
      .then((url) => !cancelled && setQr(url))
      .catch(() => !cancelled && toast.error("Could not generate QR code."));
    return () => {
      cancelled = true;
    };
  }, [umpireUrl]);

  const reportCsv = useMemo(() => {
    const header = "name,completed,walkover,total";
    const rows = umpires.map(
      (u) =>
        `"${u.name.replace(/"/g, '""')}",${u.gamesCompleted},${u.gamesWalkover},${u.gamesCompleted + u.gamesWalkover}`
    );
    return [header, ...rows].join("\n");
  }, [umpires]);

  async function addUmpire(e: React.FormEvent) {
    e.preventDefault();
    setBusy("add");
    const res = await createUmpireAction(tournamentId, newName);
    setBusy(null);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(`Added umpire. PIN: ${res.pin}`, { duration: 12000 });
    try {
      await navigator.clipboard.writeText(res.pin!);
      toast.message("PIN copied to clipboard");
    } catch {
      /* ignore */
    }
    setNewName("");
    router.refresh();
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(umpireUrl);
      toast.success("Umpire link copied");
    } catch {
      toast.error("Could not copy");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
      <div className="space-y-6">
        <section className="rounded-2xl border border-line bg-surface p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold text-bone">Umpire roster</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Each umpire gets a unique 4-digit PIN. Share the link below — they claim matches from the queue.
              </p>
            </div>
            <span
              className={
                portalOn
                  ? "rounded-full bg-bone px-2.5 py-0.5 text-xs font-medium text-ink"
                  : "rounded-full border border-line px-2.5 py-0.5 text-xs text-muted-foreground"
              }
            >
              {portalOn ? "Active" : "Add an umpire"}
            </span>
          </div>

          <form onSubmit={addUmpire} className="mt-5 flex flex-wrap items-end gap-3">
            <div className="min-w-[12rem] flex-1 space-y-2">
              <Label htmlFor="umpire-name">Name</Label>
              <Input
                id="umpire-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Maria Santos"
              />
            </div>
            <Button type="submit" className="h-11" disabled={!newName.trim() || busy !== null}>
              {busy === "add" ? <Loader2 className="animate-spin" /> : <Plus />}
              Add umpire
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11"
              disabled={busy !== null}
              onClick={async () => {
                if (!window.confirm("Sign every umpire out on all devices?")) return;
                setBusy("reset");
                await resetUmpireAccessAction(tournamentId);
                setBusy(null);
                toast.success("All umpire sessions cleared");
                router.refresh();
              }}
            >
              Sign everyone out
            </Button>
          </form>

          {umpires.length > 0 && (
            <div className="mt-6 overflow-hidden rounded-xl border border-line">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Name</TableHead>
                    <TableHead>Games</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="pr-4 text-right">PIN</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {umpires.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="pl-4 font-medium text-bone">{u.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {u.gamesCompleted + u.gamesWalkover} total
                        <span className="block text-xs">
                          {u.gamesCompleted} completed · {u.gamesWalkover} walkover
                        </span>
                      </TableCell>
                      <TableCell>{u.active ? "Active" : "Inactive"}</TableCell>
                      <TableCell className="pr-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy !== null}
                            onClick={async () => {
                              setBusy(u.id);
                              const res = await regenerateUmpirePinAction(tournamentId, u.id);
                              setBusy(null);
                              if (res.error) toast.error(res.error);
                              else {
                                toast.success(`New PIN: ${res.pin}`, { duration: 12000 });
                                try {
                                  await navigator.clipboard.writeText(res.pin!);
                                } catch {
                                  /* ignore */
                                }
                              }
                              router.refresh();
                            }}
                          >
                            <RefreshCw className="size-3.5" />
                            New PIN
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy !== null}
                            onClick={async () => {
                              setBusy(u.id);
                              const res = await setUmpireActiveAction(tournamentId, u.id, !u.active);
                              setBusy(null);
                              if (res.error) toast.error(res.error);
                              router.refresh();
                            }}
                          >
                            <UserMinus className="size-3.5" />
                            {u.active ? "Deactivate" : "Activate"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="mt-4">
            <Button variant="outline" size="sm" asChild>
              <a
                href={`data:text/csv;charset=utf-8,${encodeURIComponent(reportCsv)}`}
                download={`umpire-report-${tournamentId.slice(0, 8)}.csv`}
              >
                Download games report (CSV)
              </a>
            </Button>
          </div>
        </section>

        {pools.length > 0 && (
          <section className="rounded-2xl border border-line bg-surface p-6">
            <h2 className="font-semibold text-bone">Pool umpires</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Assign a default umpire for every match in a round-robin pool. Unclaimed scheduled matches are filled
              automatically.
            </p>
            <ul className="mt-4 space-y-3">
              {pools.map((p) => (
                <li key={`${p.divisionId}-${p.pool}`} className="flex flex-wrap items-center gap-3">
                  <span className="min-w-[10rem] text-sm text-bone">
                    {p.divisionName} · Pool {p.pool}
                  </span>
                  <Select
                    value={p.umpireId ?? "none"}
                    onValueChange={async (v) => {
                      if (!v) return;
                      setBusy(`pool-${p.divisionId}-${p.pool}`);
                      const res =
                        v === "none"
                          ? await clearPoolUmpireAction(tournamentId, p.divisionId, p.pool)
                          : await setPoolUmpireAction(tournamentId, p.divisionId, p.pool, v);
                      setBusy(null);
                      if (res.error) toast.error(res.error);
                      router.refresh();
                    }}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Unassigned</SelectItem>
                      {umpires
                        .filter((u) => u.active)
                        .map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="rounded-2xl border border-line bg-surface p-6">
          <h2 className="font-semibold text-bone">How it works for umpires</h2>
          <ol className="mt-4 space-y-3 text-sm">
            {[
              "Open the umpire link or scan the QR — no app or account.",
              "Browse the queue and live brackets without signing in.",
              "Tap Claim on a match and enter your personal 4-digit PIN.",
              "Score the match; finished games advance the bracket automatically.",
            ].map((step, i) => (
              <li key={step} className="flex gap-3">
                <span className="font-mono text-brass">0{i + 1}</span>
                <span className="text-bone/80">{step}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <section className="rounded-2xl border border-umber bg-espresso p-6 lg:w-80">
        <h2 className="font-semibold text-bone">Umpire link</h2>
        <div className="mt-4 rounded-xl bg-white p-3">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="Umpire hub QR code" width={240} height={240} className="mx-auto" />
          ) : (
            <div className="flex aspect-square items-center justify-center text-sm text-ink/60">Generating…</div>
          )}
        </div>
        <p className="mt-4 font-mono text-xs break-all text-muted-foreground">{umpireUrl}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={copyLink}>
            <Copy />
            Copy link
          </Button>
          {qr && (
            <Button type="button" variant="outline" size="sm" asChild>
              <a href={qr} download={`umpire-${tournamentId.slice(0, 8)}.png`}>
                <Download />
                Save QR
              </a>
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}
