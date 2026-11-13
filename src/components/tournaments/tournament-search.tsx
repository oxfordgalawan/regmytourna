"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, MapPin, Search, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { dateTile } from "@/lib/format";
import { NAV_FORWARD } from "@/lib/nav-transitions";
import type { TournamentSuggestion } from "@/lib/tournaments/queries";
import { cn } from "@/lib/utils";

/**
 * Event search with live suggestions as you type (typo-tolerant). Enter or
 * "Find events" opens the full results page; arrow keys pick a suggestion.
 */
export function TournamentSearch({
  action = "/tournaments",
  placeholder = "City, venue or tournament name",
  buttonLabel = "Find events",
  className,
  style,
}: {
  action?: string;
  placeholder?: string;
  buttonLabel?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const router = useRouter();
  const listId = useId();
  const boxRef = useRef<HTMLFormElement>(null);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<TournamentSuggestion[]>([]);
  const [searched, setSearched] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const term = q.trim();

  // debounced fetch; stale responses are ignored
  useEffect(() => {
    if (term.length < 2) return;
    const controller = new AbortController();
    const t = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/tournaments/suggest?q=${encodeURIComponent(term)}`, { signal: controller.signal });
        const body = (await res.json()) as { results?: TournamentSuggestion[] };
        setResults(body.results ?? []);
        setSearched(term);
        setActive(-1);
      } catch {
        // aborted or offline: keep the last suggestions
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);
    return () => {
      window.clearTimeout(t);
      controller.abort();
    };
  }, [term]);

  // close when clicking anywhere else
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);

  const showList = open && term.length >= 2 && (results.length > 0 || (searched === term && !loading));
  const shown = term.length >= 2 ? results : [];

  function goAll() {
    setOpen(false);
    router.push(term ? `${action}?q=${encodeURIComponent(term)}` : action);
  }

  function goTo(s: TournamentSuggestion) {
    setOpen(false);
    router.push(`/tournaments/${s.slug}`, { transitionTypes: NAV_FORWARD });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, shown.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, -1));
    } else if (e.key === "Escape") {
      setOpen(false);
      setActive(-1);
    } else if (e.key === "Enter" && showList && active >= 0 && active < shown.length) {
      e.preventDefault();
      goTo(shown[active]);
    }
  }

  return (
    <form
      ref={boxRef}
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        goAll();
      }}
      className={cn("relative max-w-xl", showList ? "z-50" : "z-10", className)}
      style={style}
    >
      <div
        className={cn(
          "flex items-center gap-2 rounded-full border border-line bg-espresso/80 p-1.5 pl-5 backdrop-blur focus-within:border-brass",
          showList && "rounded-b-none rounded-t-[1.6rem] border-brass sm:rounded-full"
        )}
      >
        {loading ? (
          <Loader2 className="size-5 shrink-0 animate-spin text-muted-foreground" aria-hidden />
        ) : (
          <Search className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        )}
        <label htmlFor={`${listId}-input`} className="sr-only">
          Search tournaments
        </label>
        <input
          id={`${listId}-input`}
          name="q"
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          role="combobox"
          aria-expanded={showList}
          aria-controls={`${listId}-list`}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-opt-${active}` : undefined}
          className="h-11 min-w-0 flex-1 bg-transparent text-base text-bone outline-none placeholder:text-muted-foreground"
        />
        <Button type="submit" className="rounded-full px-5">
          {buttonLabel}
        </Button>
      </div>

      {showList && (
        <div
          id={`${listId}-list`}
          role="listbox"
          className="absolute inset-x-0 top-full z-50 overflow-hidden rounded-b-[1.6rem] border border-t-0 border-brass bg-espresso shadow-[0_24px_60px_-12px_rgba(0,0,0,0.85)] sm:top-[calc(100%+0.5rem)] sm:rounded-2xl sm:border-t sm:border-line animate-in fade-in-0 slide-in-from-top-1 duration-150"
        >
          {shown.length === 0 ? (
            <div className="flex items-center gap-3 px-5 py-4 text-sm text-muted-foreground">
              <SearchX className="size-4 shrink-0" />
              No events match &ldquo;{term}&rdquo; yet.
            </div>
          ) : (
            <ul className="max-h-[min(60dvh,26rem)] overflow-y-auto py-1.5">
              {shown.map((s, i) => {
                const tile = dateTile(s.start_date);
                return (
                  <li
                    key={s.id}
                    id={`${listId}-opt-${i}`}
                    role="option"
                    aria-selected={active === i}
                    onPointerEnter={() => setActive(i)}
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => goTo(s)}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors",
                      active === i ? "bg-bone/[0.07]" : ""
                    )}
                  >
                    <span className="flex size-11 shrink-0 flex-col items-center justify-center rounded-lg border border-line bg-ink/60 leading-none">
                      {tile ? (
                        <>
                          <span className="font-mono text-[0.55rem] text-brass">{tile.month}</span>
                          <span className="display text-lg text-bone">{tile.day}</span>
                        </>
                      ) : (
                        <span className="font-mono text-[0.55rem] text-muted-foreground">TBA</span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-bone">
                        <Highlight text={s.name} query={term} />
                      </span>
                      <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                        <MapPin className="size-3 shrink-0" />
                        <span className="truncate">
                          <Highlight text={[s.venue_name?.trim(), s.city].filter(Boolean).join(" · ") || "Venue TBA"} query={term} />
                        </span>
                      </span>
                    </span>
                    <StatusBadge status={s.status} className="hidden shrink-0 sm:inline-flex" />
                  </li>
                );
              })}
            </ul>
          )}
          <button
            type="button"
            id={`${listId}-opt-${shown.length}`}
            onPointerDown={(e) => e.preventDefault()}
            onClick={goAll}
            className={cn(
              "flex w-full items-center justify-between gap-3 border-t border-line px-5 py-3 text-left text-sm text-bone transition-colors hover:bg-bone/[0.05]",
              active === shown.length && "bg-bone/[0.07]"
            )}
          >
            <span className="truncate">
              See all results for <span className="font-semibold">&ldquo;{term}&rdquo;</span>
            </span>
            <ArrowRight className="size-4 shrink-0 text-brass" />
          </button>
        </div>
      )}
    </form>
  );
}

/** Bolds the parts of `text` that match a typed word. */
function Highlight({ text, query }: { text: string; query: string }) {
  const parts = query
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((w) => w.length >= 2)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!parts.length) return <>{text}</>;
  const re = new RegExp(`(${parts.join("|")})`, "ig");
  return (
    <>
      {text.split(re).map((chunk, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="bg-transparent font-semibold text-brass">
            {chunk}
          </mark>
        ) : (
          chunk
        )
      )}
    </>
  );
}
