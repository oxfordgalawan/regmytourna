"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { Copy, Download, KeyRound, Loader2, ShieldOff } from "lucide-react";
import { toast } from "@/lib/ui/app-toast";
import { resetUmpireAccessAction, setUmpirePinAction } from "@/app/actions/umpire";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function UmpireAccessCard({
  tournamentId,
  umpireUrl,
  hasPin,
}: {
  tournamentId: string;
  umpireUrl: string;
  hasPin: boolean;
}) {
  const router = useRouter();
  const [qr, setQr] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState<"pin" | "reset" | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(umpireUrl, { width: 240, margin: 2, color: { dark: "#000000", light: "#ffffff" } })
      .then((url) => !cancelled && setQr(url))
      .catch(() => !cancelled && toast.error("Could not generate QR code."));
    return () => {
      cancelled = true;
    };
  }, [umpireUrl]);

  async function savePin(e: React.FormEvent) {
    e.preventDefault();
    setBusy("pin");
    const res = await setUmpirePinAction(tournamentId, pin);
    setBusy(null);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(hasPin ? "PIN changed" : "Umpire scoring is on");
    setPin("");
    router.refresh();
  }

  async function reset() {
    if (!window.confirm("Turn off umpire access? Every umpire phone is signed out and the PIN is removed.")) return;
    setBusy("reset");
    const res = await resetUmpireAccessAction(tournamentId);
    setBusy(null);
    toast.success("All umpires signed out");
    router.refresh();
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(umpireUrl);
      toast.success("Umpire link copied");
    } catch {
      toast.error("Could not copy to clipboard");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
      <div className="space-y-6">
        <section className="rounded-2xl border border-line bg-surface p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold text-bone">Umpire PIN</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {hasPin
                  ? "Umpire scoring is on. Share the PIN with your umpires only."
                  : "Set a 4–6 digit PIN to switch on umpire scoring."}
              </p>
            </div>
            <span
              className={
                hasPin
                  ? "rounded-full bg-bone px-2.5 py-0.5 text-xs font-medium text-ink"
                  : "rounded-full border border-line px-2.5 py-0.5 text-xs text-muted-foreground"
              }
            >
              {hasPin ? "On" : "Off"}
            </span>
          </div>

          <form onSubmit={savePin} className="mt-5 flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label htmlFor="umpire-pin">{hasPin ? "New PIN" : "PIN"}</Label>
              <Input
                id="umpire-pin"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="off"
                placeholder="e.g. 4821"
                className="w-40 font-mono text-lg tracking-[0.4em]"
              />
            </div>
            <Button type="submit" className="h-11" disabled={pin.length < 4 || busy !== null}>
              {busy === "pin" ? <Loader2 className="animate-spin" /> : <KeyRound />}
              {hasPin ? "Change PIN" : "Turn on"}
            </Button>
            {hasPin && (
              <Button type="button" variant="destructive" className="h-11" onClick={reset} disabled={busy !== null}>
                {busy === "reset" ? <Loader2 className="animate-spin" /> : <ShieldOff />}
                Turn off & sign everyone out
              </Button>
            )}
          </form>
          {hasPin && (
            <p className="mt-3 text-xs text-muted-foreground">
              Changing the PIN keeps umpires who are already signed in. To remove someone, turn access off and set a new PIN.
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-line bg-surface p-6">
          <h2 className="font-semibold text-bone">How it works for umpires</h2>
          <ol className="mt-4 space-y-3 text-sm">
            {[
              "Scan the QR code or open the link on any phone — no app, no account.",
              "Enter the PIN. They stay signed in for 12 hours.",
              "Tap a match on the board to open the scoresheet. Tap a team to add a point; Undo fixes mistakes.",
              "End each game when it's over. Finished matches are sent to the Challonge bracket automatically.",
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
            <img src={qr} alt="Umpire scoring QR code" width={240} height={240} className="mx-auto" />
          ) : (
            <div className="flex aspect-square items-center justify-center text-sm text-ink/60">Generating…</div>
          )}
        </div>
        <p className="mt-4 font-mono text-xs break-all text-muted-foreground">{umpireUrl}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={copy}>
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
