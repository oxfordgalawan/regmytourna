"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Slide = { path: string; url: string | null };

export function PetitionImageViewer({
  open,
  onOpenChange,
  title,
  slides,
  initialIndex = 0,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  slides: Slide[];
  initialIndex?: number;
}) {
  const [index, setIndex] = useState(initialIndex);

  useEffect(() => {
    if (open) setIndex(initialIndex);
  }, [open, initialIndex]);

  const go = useCallback(
    (delta: number) => {
      if (!slides.length) return;
      setIndex((i) => (i + delta + slides.length) % slides.length);
    },
    [slides.length]
  );

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
      if (e.key === "Escape") onOpenChange(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, go, onOpenChange]);

  const current = slides[index];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl gap-0 overflow-hidden p-0">
        <DialogHeader className="flex flex-row items-center justify-between gap-2 border-b border-line px-4 py-3">
          <DialogTitle className="text-base">{title ?? "Proof images"}</DialogTitle>
          <Button type="button" size="icon-sm" variant="ghost" onClick={() => onOpenChange(false)}>
            <X className="size-4" />
          </Button>
        </DialogHeader>
        <div className="relative flex min-h-[min(70vh,28rem)] items-center justify-center bg-ink/40">
          {slides.length > 1 && (
            <>
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="absolute left-2 top-1/2 z-10 -translate-y-1/2"
                onClick={() => go(-1)}
              >
                <ChevronLeft />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="absolute right-2 top-1/2 z-10 -translate-y-1/2"
                onClick={() => go(1)}
              >
                <ChevronRight />
              </Button>
            </>
          )}
          {!current?.url ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading image…
            </p>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={current.url}
              alt={`Proof ${index + 1} of ${slides.length}`}
              className="max-h-[min(70vh,28rem)] w-full object-contain"
            />
          )}
          {slides.length > 1 && (
            <span className="absolute bottom-3 rounded-full bg-ink/80 px-3 py-1 font-mono text-xs text-bone">
              {index + 1} / {slides.length}
            </span>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
