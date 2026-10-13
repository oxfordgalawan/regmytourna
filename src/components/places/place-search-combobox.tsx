"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Loader2, MapPin, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PlaceSelection = {
  psgcCode: string;
  label: string;
  /** filled when picked from suggestions */
  cityMunicipalityName?: string;
  regionName?: string;
};

type ApiResult = {
  id: string;
  level: string;
  label: string;
  cityMunicipalityName?: string;
  regionName?: string;
};

export function PlaceSearchCombobox({
  value,
  onChange,
  disabled,
  id: idProp,
  label = "City or barangay",
  hint = "Optional. Start typing your barangay or city/municipality.",
  placeholder = "e.g. Quezon City or Brgy Holy Spirit",
}: {
  value: PlaceSelection | null;
  onChange: (next: PlaceSelection | null) => void;
  disabled?: boolean;
  id?: string;
  label?: string;
  hint?: string;
  placeholder?: string;
}) {
  const autoId = useId();
  const inputId = idProp ?? autoId;
  const listId = `${inputId}-listbox`;

  const [query, setQuery] = useState(value?.label ?? "");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ApiResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const fetchResults = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/places/search?q=${encodeURIComponent(q)}&limit=15`);
      const json = (await res.json()) as { results?: ApiResult[] };
      setResults(json.results ?? []);
      setActiveIndex(-1);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open || value?.label === query) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void fetchResults(query);
    }, 220);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open, fetchResults, value?.label]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function select(item: ApiResult) {
    onChange({
      psgcCode: item.id,
      label: item.label,
      cityMunicipalityName: item.cityMunicipalityName,
      regionName: item.regionName,
    });
    setQuery(item.label);
    setOpen(false);
    setResults([]);
  }

  function clear() {
    onChange(null);
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="space-y-2">
      <Label htmlFor={inputId}>{label}</Label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <div className="relative">
        <MapPin className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={inputId}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          disabled={disabled}
          value={query}
          placeholder={placeholder}
          className="pl-10 pr-20"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (value && e.target.value !== value.label) {
              onChange(null);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              return;
            }
            if (!open || results.length === 0) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActiveIndex((i) => (i + 1) % results.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
            } else if (e.key === "Enter" && activeIndex >= 0) {
              e.preventDefault();
              select(results[activeIndex]!);
            }
          }}
        />
        <div className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-1">
          {loading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
          {value && (
            <Button type="button" variant="ghost" size="icon" className="size-8" onClick={clear} aria-label="Clear location">
              <X className="size-4" />
            </Button>
          )}
        </div>
        {open && (results.length > 0 || (query.trim().length >= 2 && !loading)) && (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-line bg-surface py-1 shadow-lg"
          >
            {results.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">No places found.</li>
            ) : (
              results.map((item, index) => (
                <li key={item.id} role="option" aria-selected={index === activeIndex}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full flex-col items-start px-3 py-2 text-left text-sm transition-colors hover:bg-espresso/60",
                      index === activeIndex && "bg-espresso/60"
                    )}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => select(item)}
                  >
                    <span className="font-medium text-bone">{item.label}</span>
                    <span className="text-xs capitalize text-muted-foreground">
                      {item.level.replace(/_/g, " ")}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
