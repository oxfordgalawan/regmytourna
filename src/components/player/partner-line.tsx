"use client";

import { useTransition } from "react";
import { CheckCircle2, Mail, UserRound, UserX } from "lucide-react";
import { toast } from "@/lib/ui/app-toast";
import { resendPartnerInviteAction } from "@/app/actions/partner-invites";
import type { PlayerEntry } from "@/lib/player/entries";
import { cn } from "@/lib/utils";

/** "Maria Santos · joined" / "invite sent · Resend". Changing partners lives in Manage entry. */
export function PartnerLine({ entry: e }: { entry: PlayerEntry }) {
  const [pending, startTransition] = useTransition();
  const p = e.partner;
  if (!p) return null;

  function resend() {
    startTransition(async () => {
      const res = await resendPartnerInviteAction(e.id);
      if (res.error) toast.error(res.error);
      else toast.success(`Invite sent to ${p?.email}`);
    });
  }

  const status = !e.isRegistrant
    ? { icon: UserRound, text: "Your partner", tone: "text-muted-foreground" }
    : p.state === "joined"
      ? { icon: CheckCircle2, text: "Joined", tone: "text-brass" }
      : p.state === "invited"
        ? { icon: Mail, text: "Invite sent", tone: "text-muted-foreground" }
        : p.state === "declined"
          ? { icon: UserX, text: "Said it's not them", tone: "text-[#e58a72]" }
          : { icon: UserRound, text: "No email", tone: "text-muted-foreground" };

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      <span className="min-w-0 truncate text-bone/90">{p.name || p.email || "Partner"}</span>
      <span className={cn("flex items-center gap-1 text-xs", status.tone)}>
        <status.icon className="size-3.5" />
        {status.text}
      </span>
      {e.isRegistrant && e.canChangePartner && p.state === "invited" && (
        <button
          type="button"
          disabled={pending}
          onClick={resend}
          className="text-xs text-bone underline underline-offset-4 disabled:opacity-50"
        >
          {pending ? "Sending…" : "Resend"}
        </button>
      )}
    </div>
  );
}
