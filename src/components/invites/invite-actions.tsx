"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, UserX } from "lucide-react";
import { toast } from "@/lib/ui/app-toast";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Action = () => Promise<{ ok?: true; error?: string }>;

/** Accept / Not me, with a check-mark moment before moving on. */
export function InviteActions({
  accept,
  decline,
  acceptLabel = "Accept — add to my entries",
  afterAccept = "/entries",
  compact = false,
  declineOnly = false,
  copy = {},
}: {
  accept: Action;
  decline: Action;
  acceptLabel?: string;
  /** where to go after accepting; null stays put (refreshes) */
  afterAccept?: string | null;
  compact?: boolean;
  /** logged-out visitors can still say "not me" */
  declineOnly?: boolean;
  /** wording overrides (defaults fit partner invites) */
  copy?: { decline?: string; confirmDecline?: string; confirmDeclineButton?: string; declined?: string; accepted?: string };
}) {
  const text = {
    decline: "Not me",
    confirmDecline: "Not your entry? We'll remove your email and tell the player so they can fix their partner.",
    confirmDeclineButton: "Yes, it's not me",
    declined: "Got it — we'll let them know.",
    accepted: "You're on the team. Opening your entries…",
    ...copy,
  };
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const [done, setDone] = useState<"accepted" | "declined" | null>(null);
  const [confirmDecline, setConfirmDecline] = useState(false);

  function run(kind: "accept" | "decline") {
    setBusy(kind);
    startTransition(async () => {
      const res = await (kind === "accept" ? accept() : decline());
      setBusy(null);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setDone(kind === "accept" ? "accepted" : "declined");
      setTimeout(() => {
        if (kind === "accept" && afterAccept) router.push(afterAccept);
        else router.refresh();
      }, 1100);
    });
  }

  if (done) {
    return (
      <div className={cn("flex items-center gap-3", compact ? "py-1" : "py-2")} role="status">
        <span
          className={cn(
            "flex size-10 animate-[pop_400ms_cubic-bezier(.2,1.4,.4,1)_both] items-center justify-center rounded-full",
            done === "accepted" ? "bg-bone text-ink" : "bg-umber text-bone"
          )}
        >
          {done === "accepted" ? <Check className="size-5" strokeWidth={3} /> : <UserX className="size-5" />}
        </span>
        <p className="text-sm text-bone">
          {done === "accepted" ? text.accepted : text.declined}
        </p>
      </div>
    );
  }

  if (confirmDecline) {
    return (
      <div className="space-y-3 rounded-xl border border-line bg-ink/40 p-4">
        <p className="text-sm text-bone">{text.confirmDecline}</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="destructive" disabled={pending} onClick={() => run("decline")}>
            {busy === "decline" && <Loader2 className="animate-spin" />}
            {text.confirmDeclineButton}
          </Button>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirmDecline(false)}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  if (declineOnly) {
    return (
      <button
        type="button"
        onClick={() => setConfirmDecline(true)}
        className="text-sm text-muted-foreground underline-offset-4 hover:text-bone hover:underline"
      >
        {text.decline}
      </button>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button size={compact ? "sm" : "lg"} disabled={pending} onClick={() => run("accept")}>
        {busy === "accept" ? <Loader2 className="animate-spin" /> : <Check />}
        {acceptLabel}
      </Button>
      <Button size={compact ? "sm" : "lg"} variant="ghost" disabled={pending} onClick={() => setConfirmDecline(true)}>
        {text.decline}
      </Button>
    </div>
  );
}
