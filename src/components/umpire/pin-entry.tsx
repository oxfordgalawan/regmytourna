"use client";

import { useState } from "react";
import { Delete, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];
const PIN_LEN = 4;

/** Compact 4-digit PIN pad for claim / sign-in dialogs. */
export function PinEntry({
  label,
  busy,
  onSubmit,
}: {
  label: string;
  busy?: boolean;
  onSubmit: (pin: string) => Promise<{ error?: string } | void>;
}) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(value = pin) {
    if (value.length < PIN_LEN || busy) return;
    setError(null);
    const res = await onSubmit(value);
    if (res && "error" in res && res.error) {
      setError(res.error);
      setPin("");
      if (navigator.vibrate) navigator.vibrate([30, 40, 30]);
    }
  }

  function press(key: string) {
    setError(null);
    if (key === "del") return setPin((p) => p.slice(0, -1));
    if (!key || pin.length >= PIN_LEN) return;
    const next = pin + key;
    setPin(next);
    if (next.length === PIN_LEN) submit(next);
  }

  return (
    <div>
      <p className="text-center text-sm text-muted-foreground">{label}</p>
      <div
        className={cn("mt-4 flex justify-center gap-3", error && "animate-[shake_0.35s_ease-in-out]")}
        aria-live="polite"
      >
        {Array.from({ length: PIN_LEN }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "size-3.5 rounded-full border transition-all duration-150",
              i < pin.length ? "scale-110 border-bone bg-bone" : "border-bone/30"
            )}
          />
        ))}
      </div>
      <p className="mt-3 min-h-5 text-center text-sm text-[#e58a72]" role="alert">
        {error}
      </p>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {KEYS.map((key, i) =>
          key === "" ? (
            <span key={i} />
          ) : (
            <button
              key={i}
              type="button"
              onClick={() => press(key)}
              disabled={busy}
              aria-label={key === "del" ? "Delete last digit" : key}
              className="flex h-14 items-center justify-center rounded-xl border border-line bg-surface text-xl text-bone transition-all active:scale-95 active:bg-umber disabled:opacity-50"
            >
              {key === "del" ? <Delete className="size-5" /> : <span className="display">{key}</span>}
            </button>
          )
        )}
      </div>
      <Button size="lg" className="mt-4 w-full" onClick={() => submit()} disabled={pin.length < PIN_LEN || busy}>
        {busy && <Loader2 className="animate-spin" />}
        Continue
      </Button>
    </div>
  );
}
