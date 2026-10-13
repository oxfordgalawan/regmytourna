"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Delete, Loader2 } from "lucide-react";
import { umpireSignInAction } from "@/app/actions/umpire";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];

/** Phone-sized PIN entry for umpires. */
export function PinPad({ tournamentId, tournamentName }: { tournamentId: string; tournamentName: string }) {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(value = pin) {
    if (value.length < 4 || loading) return;
    setLoading(true);
    setError(null);
    const res = await umpireSignInAction(tournamentId, value);
    setLoading(false);
    if (res.error) {
      setError(res.error);
      setPin("");
      if (navigator.vibrate) navigator.vibrate([30, 40, 30]);
      return;
    }
    router.refresh();
  }

  function press(key: string) {
    setError(null);
    if (key === "del") return setPin((p) => p.slice(0, -1));
    if (!key || pin.length >= 6) return;
    const next = pin + key;
    setPin(next);
    if (next.length === 6) submit(next);
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))]">
      <p className="eyebrow text-center">Umpire scoring</p>
      <h1 className="display mt-3 text-center text-4xl text-bone text-balance">{tournamentName}</h1>
      <p className="mt-3 text-center text-sm text-muted-foreground">Enter the PIN from the organizer.</p>

      <div
        className={cn("mt-8 flex justify-center gap-3", error && "animate-[shake_0.35s_ease-in-out]")}
        aria-live="polite"
        aria-label={`${pin.length} digits entered`}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "size-3.5 rounded-full border transition-all duration-150",
              i < pin.length ? "scale-110 border-bone bg-bone" : "border-bone/30",
              i >= 4 && i >= pin.length && "opacity-40"
            )}
          />
        ))}
      </div>
      <p className="mt-4 min-h-5 text-center text-sm text-[#e58a72]" role="alert">
        {error}
      </p>

      <div className="mt-4 grid grid-cols-3 gap-3">
        {KEYS.map((key, i) =>
          key === "" ? (
            <span key={i} />
          ) : (
            <button
              key={i}
              type="button"
              onClick={() => press(key)}
              disabled={loading}
              aria-label={key === "del" ? "Delete last digit" : key}
              className="flex h-16 items-center justify-center rounded-2xl border border-line bg-surface text-2xl text-bone transition-all active:scale-95 active:bg-umber disabled:opacity-50"
            >
              {key === "del" ? <Delete className="size-6" /> : <span className="display">{key}</span>}
            </button>
          )
        )}
      </div>

      <Button size="lg" className="mt-6 w-full" onClick={() => submit()} disabled={pin.length < 4 || loading}>
        {loading && <Loader2 className="animate-spin" />}
        Start scoring
      </Button>
    </div>
  );
}
