"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ImageLightbox({
  open,
  onOpenChange,
  src,
  alt,
  title,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  src: string;
  alt: string;
  title?: string;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onOpenChange(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[96vh] w-[min(96vw,44rem)] max-w-[min(96vw,44rem)] flex-col gap-0 overflow-hidden border-line bg-ink p-0 sm:max-w-[min(96vw,44rem)]"
      >
        <DialogHeader className="flex shrink-0 flex-row items-center justify-between gap-2 border-b border-line px-4 py-3">
          <DialogTitle className="truncate text-base">{title ?? alt}</DialogTitle>
          <Button type="button" size="icon-sm" variant="ghost" onClick={() => onOpenChange(false)}>
            <X className="size-4" />
            <span className="sr-only">Close</span>
          </Button>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain bg-black/70 p-2 sm:p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className="mx-auto block h-auto w-full max-w-full rounded-sm"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
