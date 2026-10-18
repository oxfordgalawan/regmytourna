"use client";

import { useEffect, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ErrorState = {
  open: boolean;
  message: string;
  title: string;
};

const DEFAULT_TITLE = "Something went wrong";

let state: ErrorState = { open: false, message: "", title: DEFAULT_TITLE };
const listeners = new Set<(next: ErrorState) => void>();

function emit(next: ErrorState) {
  state = next;
  listeners.forEach((l) => l(next));
}

export function showError(message: string, options?: { title?: string }) {
  const text = typeof message === "string" ? message.trim() : String(message);
  emit({
    open: true,
    message: text || "An unexpected error occurred.",
    title: options?.title ?? DEFAULT_TITLE,
  });
}

function dismissError() {
  emit({ ...state, open: false });
}

/** Global modal for user-facing errors (replaces error toasts). */
export function ErrorDialogProvider() {
  const [open, setOpen] = useState(state.open);
  const [message, setMessage] = useState(state.message);
  const [title, setTitle] = useState(state.title);

  useEffect(() => {
    const sync = (next: ErrorState) => {
      setOpen(next.open);
      setMessage(next.message);
      setTitle(next.title);
    };
    listeners.add(sync);
    sync(state);
    return () => {
      listeners.delete(sync);
    };
  }, []);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) dismissError();
      }}
    >
      <DialogContent className="sm:max-w-md" showCloseButton={false} role="alertdialog">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-rust/15 text-rust">
              <TriangleAlert className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <DialogTitle className="text-left text-lg text-bone">{title}</DialogTitle>
              <DialogDescription className="mt-2 text-left break-words text-muted-foreground">
                {message}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DialogFooter className="border-t-0 bg-transparent sm:justify-end">
          <Button type="button" onClick={dismissError}>
            OK
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
