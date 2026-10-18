"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { Check, Copy, Download, Eye, EyeOff, Loader2, Plus, RefreshCw, RotateCcw, Trash2, UserMinus } from "lucide-react";
import { toast } from "@/lib/ui/app-toast";
import {
  createUmpireAction,
  regenerateUmpirePinAction,
  resetUmpireAccessAction,
  clearPoolUmpireAction,
  deleteUmpireAction,
  restoreUmpireAction,
  revealUmpirePinAction,
  setPoolUmpireAction,
  setUmpireActiveAction,
} from "@/app/actions/umpire";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
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
  deleted = [],
  pools,
}: {
  tournamentId: string;
  umpireUrl: string;
  umpires: RosterUmpire[];
  deleted?: Array<{ id: string; name: string; deletedAt: string }>;
  pools: PoolRow[];
}) {
  const router = useRouter();
  const [qr, setQr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<"active" | "deleted">("active");
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<RosterUmpire | null>(null);
  // only one PIN on screen at a time, and it hides itself
  const [revealed, setRevealed] = useState<{ id: string; pin: string } | null>(null);
  useEffect(() => {
    if (!revealed) return;
    const t = setTimeout(() => setRevealed(null), 15000);
    return () => clearTimeout(t);
  }, [revealed]);

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

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button type="button" onClick={() => setAdding(true)} disabled={busy !== null}>
              <Plus />
              Add umpire
            </Button>
            <Button
              type="button"
              variant="outline"
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
          </div>

          {(umpires.length > 0 || deleted.length > 0) && (
            <div className="mt-6 flex gap-1 border-b border-line" role="tablist">
              {(
                [
                  ["active", `Umpires · ${umpires.length}`],
                  ["deleted", `Deleted · ${deleted.length}`],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={tab === key}
                  onClick={() => setTab(key)}
                  className={cn(
                    "-mb-px border-b-2 px-3 pb-2.5 text-sm transition-colors",
                    tab === key ? "border-bone text-bone" : "border-transparent text-muted-foreground hover:text-bone"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {tab === "deleted" && (
            <div className="mt-4">
              {!deleted.length ? (
                <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted-foreground">
                  No deleted umpires.
                </p>
              ) : (
                <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
                  {deleted.map((u) => (
                    <li key={u.id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-bone">{u.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          Deleted {new Date(u.deletedAt).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}
                        </span>
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy !== null}
                        onClick={async () => {
                          setBusy(u.id);
                          const res = await restoreUmpireAction(tournamentId, u.id);
                          setBusy(null);
                          if (res.error) toast.error(res.error);
                          else toast.success(`${u.name} restored — same PIN as before`);
                          router.refresh();
                        }}
                      >
                        {busy === u.id ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
                        Restore
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {tab === "active" && umpires.length > 0 && (
            <div className="mt-4 overflow-hidden rounded-xl border border-line">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Name</TableHead>
                    <TableHead>Games</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>PIN</TableHead>
                    <TableHead className="pr-4 text-right">
                      <span className="sr-only">Actions</span>
                    </TableHead>
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
                      <TableCell>
                        <PinCell
                          tournamentId={tournamentId}
                          umpire={u}
                          shown={revealed?.id === u.id ? revealed.pin : null}
                          onShow={(pin) => setRevealed(pin ? { id: u.id, pin } : null)}
                        />
                      </TableCell>
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
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            disabled={busy !== null}
                            aria-label={`Delete ${u.name}`}
                            title="Delete"
                            onClick={() => setRemoving(u)}
                          >
                            <Trash2 />
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
            <h2 className="font-semibold text-bone">Pre-assign umpire</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Give a round-robin pool its umpire ahead of time. Every unclaimed match in that pool goes to them
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
                    // labels for the trigger, so it shows the umpire's name instead of their id
                    items={[{ value: "none", label: "Unassigned" }, ...umpires.map((u) => ({ value: u.id, label: u.name }))]}
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

      <AddUmpireDialog
        tournamentId={tournamentId}
        open={adding}
        onOpenChange={setAdding}
        onAdded={() => router.refresh()}
      />

      <Dialog open={Boolean(removing)} onOpenChange={(o) => !o && busy === null && setRemoving(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogTitle>Delete {removing?.name}?</DialogTitle>
          <DialogDescription>
            They&apos;re signed out and their unstarted matches go back to the queue for others to claim. You can
            restore them from the Deleted tab — their games history is kept.
          </DialogDescription>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" disabled={busy !== null} onClick={() => setRemoving(null)}>
              Keep
            </Button>
            <Button
              variant="destructive"
              disabled={busy !== null}
              onClick={async () => {
                if (!removing) return;
                setBusy(removing.id);
                const res = await deleteUmpireAction(tournamentId, removing.id);
                setBusy(null);
                if (res.error) {
                  toast.error(res.error);
                  return;
                }
                toast.success(`${removing.name} deleted`);
                setRemoving(null);
                router.refresh();
              }}
            >
              {busy !== null && <Loader2 className="animate-spin" />}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Add an umpire in a modal, then show their PIN big enough to read out. */
function AddUmpireDialog({
  tournamentId,
  open,
  onOpenChange,
  onAdded,
}: {
  tournamentId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onAdded: () => void;
}) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<{ name: string; pin: string } | null>(null);
  const [copied, setCopied] = useState(false);

  function close(o: boolean) {
    if (saving) return;
    onOpenChange(o);
    if (!o)
      setTimeout(() => {
        setName("");
        setCreated(null);
        setCopied(false);
      }, 200);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await createUmpireAction(tournamentId, name);
    setSaving(false);
    if (res.error || !res.pin) {
      toast.error(res.error ?? "Couldn't add the umpire.");
      return;
    }
    setCreated({ name: name.trim(), pin: res.pin });
    onAdded();
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-sm">
        {created ? (
          <div className="flex flex-col items-center text-center">
            <DialogTitle>{created.name} is ready</DialogTitle>
            <DialogDescription>Give them this PIN. They&apos;ll use it to claim and score matches.</DialogDescription>
            <p className="display mt-5 text-6xl tracking-[0.3em] text-bone tabular-nums">{created.pin}</p>
            <div className="mt-6 flex w-full flex-wrap justify-center gap-2">
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(created.pin);
                    setCopied(true);
                  } catch {
                    toast.error("Could not copy");
                  }
                }}
              >
                {copied ? <Check /> : <Copy />}
                {copied ? "Copied" : "Copy PIN"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setCreated(null);
                  setName("");
                  setCopied(false);
                }}
              >
                <Plus />
                Add another
              </Button>
              <Button onClick={() => close(false)}>Done</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={save} className="space-y-4">
            <DialogTitle>Add umpire</DialogTitle>
            <DialogDescription>We&apos;ll create a personal 4-digit PIN for them.</DialogDescription>
            <div className="space-y-2">
              <Label htmlFor="umpire-name">Name</Label>
              <Input
                id="umpire-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Maria Santos"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" disabled={saving} onClick={() => close(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || name.trim().length < 2}>
                {saving ? <Loader2 className="animate-spin" /> : <Plus />}
                Add umpire
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** "••••" with Reveal (this umpire only) and Copy. PINs are fetched on demand, never sent with the page. */
function PinCell({
  tournamentId,
  umpire,
  shown,
  onShow,
}: {
  tournamentId: string;
  umpire: RosterUmpire;
  shown: string | null;
  onShow: (pin: string | null) => void;
}) {
  const [busy, setBusy] = useState<"reveal" | "copy" | null>(null);
  const [copied, setCopied] = useState(false);

  async function fetchPin() {
    const res = await revealUmpirePinAction(tournamentId, umpire.id);
    if (res.error || !res.pin) {
      toast.error(res.error ?? "Couldn't load the PIN.");
      return null;
    }
    return res.pin;
  }

  return (
    <span className="flex items-center gap-1">
      <span
        className={cn(
          "w-14 font-mono text-sm tracking-[0.3em] tabular-nums",
          shown ? "text-bone" : "text-muted-foreground"
        )}
        aria-label={shown ? `PIN ${shown.split("").join(" ")}` : "PIN hidden"}
      >
        {shown ?? "••••"}
      </span>
      <Button
        size="icon-sm"
        variant="ghost"
        disabled={busy !== null}
        aria-label={shown ? `Hide ${umpire.name}'s PIN` : `Reveal ${umpire.name}'s PIN`}
        title={shown ? "Hide" : "Reveal"}
        onClick={async () => {
          if (shown) return onShow(null);
          setBusy("reveal");
          const pin = await fetchPin();
          setBusy(null);
          if (pin) onShow(pin);
        }}
      >
        {busy === "reveal" ? <Loader2 className="animate-spin" /> : shown ? <EyeOff /> : <Eye />}
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        disabled={busy !== null}
        aria-label={`Copy ${umpire.name}'s PIN`}
        title="Copy PIN"
        onClick={async () => {
          setBusy("copy");
          const pin = shown ?? (await fetchPin());
          setBusy(null);
          if (!pin) return;
          try {
            await navigator.clipboard.writeText(pin);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
            toast.success(`${umpire.name}'s PIN copied`);
          } catch {
            toast.error("Could not copy");
          }
        }}
      >
        {busy === "copy" ? <Loader2 className="animate-spin" /> : copied ? <Check /> : <Copy />}
      </Button>
    </span>
  );
}
