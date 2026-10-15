"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Mail, UserRound, UserX } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { changePartnerAction, resendPartnerInviteAction } from "@/app/actions/partner-invites";
import type { PlayerEntry } from "@/lib/player/entries";
import { cn } from "@/lib/utils";

/** "Maria Santos · joined" / "invite sent · Resend" / "said not me · Change partner". */
export function PartnerLine({ entry: e }: { entry: PlayerEntry }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(e.partner?.name ?? "");
  const [email, setEmail] = useState(e.partner?.email ?? "");
  const p = e.partner;
  if (!p) return null;

  const manage = e.isRegistrant && e.canChangePartner;

  function resend() {
    startTransition(async () => {
      const res = await resendPartnerInviteAction(e.id);
      if (res.error) toast.error(res.error);
      else toast.success(`Invite sent to ${p?.email}`);
    });
  }

  function save() {
    startTransition(async () => {
      const res = await changePartnerAction(e.id, { name, email });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(email ? "Partner updated — we've emailed them." : "Partner updated.");
      setEditing(false);
      router.refresh();
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
    <>
      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <span className="min-w-0 truncate text-bone/90">{p.name || p.email || "Partner"}</span>
        <span className={cn("flex items-center gap-1 text-xs", status.tone)}>
          <status.icon className="size-3.5" />
          {status.text}
        </span>
        {manage && p.state === "invited" && (
          <button
            type="button"
            disabled={pending}
            onClick={resend}
            className="text-xs text-bone underline underline-offset-4 disabled:opacity-50"
          >
            {pending ? "Sending…" : "Resend"}
          </button>
        )}
        {manage && p.state !== "joined" && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className={cn(
              "text-xs underline underline-offset-4",
              p.state === "declined" ? "font-semibold text-bone" : "text-muted-foreground hover:text-bone"
            )}
          >
            Change partner
          </button>
        )}
      </div>

      <Dialog open={editing} onOpenChange={(open) => !pending && setEditing(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change partner</DialogTitle>
            <DialogDescription>
              We&apos;ll email your partner a link to see the entry. Your payment and spot stay the same.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`pn-${e.id}`}>Partner&apos;s name</Label>
              <Input id={`pn-${e.id}`} value={name} onChange={(ev) => setName(ev.target.value)} autoComplete="off" />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`pe-${e.id}`}>Partner&apos;s email (optional)</Label>
              <Input
                id={`pe-${e.id}`}
                type="email"
                inputMode="email"
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                autoComplete="off"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" disabled={pending} onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button disabled={pending || !name.trim()} onClick={save}>
              {pending && <Loader2 className="animate-spin" />}
              Save partner
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
