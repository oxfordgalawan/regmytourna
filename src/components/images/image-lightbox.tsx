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
      <DialogContent className="max-h-[min(96vh,56rem)] max-w-[min(96vw,72rem)] gap-0 overflow-hidden border-line bg-ink p-0">
        <DialogHeader className="flex flex-row items-center justify-between gap-2 border-b border-line px-4 py-3">
          <DialogTitle className="truncate text-base">{title ?? alt}</DialogTitle>
          <Button type="button" size="icon-sm" variant="ghost" onClick={() => onOpenChange(false)}>
            <X className="size-4" />
            <span className="sr-only">Close</span>
          </Button>
        </DialogHeader>
        <div className="flex max-h-[calc(96vh-4rem)] items-center justify-center bg-black/40 p-2 sm:p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} className="max-h-[calc(92vh-5rem)] w-full object-contain" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
