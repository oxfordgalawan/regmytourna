"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import type { CitySuggestion } from "@/app/api/tournaments/cities/route";
import { cn } from "@/lib/utils";

/**
 * The "Any city" box on the tournaments filter. Suggests cities as you type —
 * ones with events first (with a count), then other Philippine cities — and
 * applies the filter as soon as one is picked.
 */
export function CityFilterInput({ defaultValue, className }: { defaultValue?: string; className?: string }) {
  const id = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(defaultValue ?? "");
  const [results, setResults] = useState<CitySuggestion[]>([]);
  const [searched, setSearched] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const term = value.trim();

  useEffect(() => {
    if (term.length < 2) return;
    const controller = new AbortController();
    const t = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/tournaments/cities?q=${encodeURIComponent(term)}`, { signal: controller.signal });
        const body = (await res.json()) as { results?: CitySuggestion[] };
        setResults(body.results ?? []);
        setSearched(term);
        setActive(-1);
      } catch {
        // aborted or offline
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 150);
    return () => {
      window.clearTimeout(t);
      controller.abort();
    };
  }, [term]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);

  const shown = term.length >= 2 ? results : [];
  // don't re-suggest the exact city that's already applied
  const isApplied = shown.length === 1 && shown[0].name.toLowerCase() === term.toLowerCase();
  const showList = open && term.length >= 2 && !isApplied && (shown.length > 0 || (searched === term && !loading));

  function pick(c: CitySuggestion) {
    setValue(c.name);
    setOpen(false);
    setActive(-1);
    // apply the filter right away (state flushes before the form reads the input)
    window.setTimeout(() => inputRef.current?.form?.requestSubmit(), 0);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, shown.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, -1));
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Enter" && showList && active >= 0 && shown[active]) {
      e.preventDefault();
      pick(shown[active]);
    }
  }

  return (
    <div ref={wrapRef} className={cn("relative", showList && "z-40", className)}>
      <label htmlFor={`${id}-city`} className="sr-only">
        City
      </label>
      {loading ? (
        <Loader2 className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      ) : (
        <MapPin className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
      )}
      <input
        ref={inputRef}
        id={`${id}-city`}
        name="city"
        type="search"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Any city"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        role="combobox"
        aria-expanded={showList}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${id}-opt-${active}` : undefined}
        className="h-11 w-full rounded-lg border border-input bg-ink/40 pr-3 pl-10 text-base text-bone outline-none placeholder:text-muted-foreground hover:border-bone/30 focus-visible:border-brass md:text-sm"
      />

      {showList && (
        <div
          id={`${id}-list`}
          role="listbox"
          className="absolute inset-x-0 top-[calc(100%+0.375rem)] min-w-64 overflow-hidden rounded-xl border border-line bg-espresso shadow-[0_24px_60px_-12px_rgba(0,0,0,0.85)] animate-in fade-in-0 slide-in-from-top-1 duration-150 sm:left-auto sm:right-0 sm:w-96"
        >
          {shown.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">No city matches &ldquo;{term}&rdquo;.</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto py-1">
              {shown.map((c, i) => (
                <li
                  key={`${c.name}-${c.province}`}
                  id={`${id}-opt-${i}`}
                  role="option"
                  aria-selected={active === i}
                  onPointerEnter={() => setActive(i)}
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => pick(c)}
                  className={cn("flex cursor-pointer items-center gap-3 px-3.5 py-2.5", active === i && "bg-bone/[0.07]")}
                >
                  <MapPin className={cn("size-4 shrink-0", c.events ? "text-brass" : "text-muted-foreground")} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-bone">{c.name}</span>
                    {c.province && <span className="block truncate text-xs text-muted-foreground">{c.province}</span>}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 font-mono text-[0.65rem]",
                      c.events ? "bg-brass/15 text-brass" : "text-muted-foreground"
                    )}
                  >
                    {c.events ? `${c.events} ${c.events === 1 ? "event" : "events"}` : "No events yet"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
