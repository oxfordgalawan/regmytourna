"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Crown, Link2, Loader2, LogOut, Mail, MoreHorizontal, RefreshCw, Send, UserPlus, X } from "lucide-react";
import { toast } from "@/lib/ui/app-toast";
import {
  cancelCoOrganizerInviteAction,
  inviteCoOrganizerAction,
  leaveEventAction,
  removeCoOrganizerAction,
  resendCoOrganizerInviteAction,
  setInviteLinkAction,
} from "@/app/actions/organizer-team";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PlayerAvatar } from "@/components/players/player-avatar";
import type { PendingInvite, TeamMember } from "@/lib/organizers/team";
import { cn } from "@/lib/utils";

const CAN = [
  "Categories, players & registrations",
  "Brackets, matches & the court queue",
  "Courts, umpires & the TV display",
  "Check-in and collecting payments at the desk",
];
const CANT = ["Invite or remove co-organizers", "Payouts — entry fees go to the owner's wallet"];

export function TeamPanel({
  tournamentId,
  meId,
  owner,
  team,
  pending,
  link,
  appUrl,
}: {
  tournamentId: string;
  meId: string;
  owner: boolean;
  team: TeamMember[];
  pending: PendingInvite[];
  link: string | null;
  appUrl: string;
}) {
  const router = useRouter();
  const [inviting, setInviting] = useState(false);
  const [confirm, setConfirm] = useState<{ kind: "remove"; member: TeamMember } | { kind: "leave" } | null>(null);
  const [pendingAction, startTransition] = useTransition();

  function run(fn: () => Promise<{ error?: string }>, ok: string, after?: () => void) {
    startTransition(async () => {
      const res = await fn();
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(ok);
      after?.();
      router.refresh();
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-6">
        <section className="rounded-2xl border border-line bg-surface">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
            <div>
              <h2 className="font-semibold text-bone">Organizing team</h2>
              <p className="text-sm text-muted-foreground">
                {team.length} {team.length === 1 ? "person" : "people"} can run this event.
              </p>
            </div>
            {owner && (
              <Button onClick={() => setInviting(true)}>
                <UserPlus />
                Invite co-organizer
              </Button>
            )}
          </header>
          <ul className="divide-y divide-line">
            {team.map((m) => (
              <li key={m.userId} className="flex items-center gap-3 px-5 py-3.5">
                <PlayerAvatar name={m.name} src={m.avatarUrl} className="size-10 text-xs" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate text-sm font-medium text-bone">
                    {m.name}
                    {m.userId === meId && <span className="text-xs font-normal text-muted-foreground">(you)</span>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{m.email ?? "—"}</p>
                </div>
                <span
                  className={cn(
                    "flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs",
                    m.owner ? "bg-brass/15 text-brass" : "border border-line text-muted-foreground"
                  )}
                >
                  {m.owner && <Crown className="size-3" />}
                  {m.owner ? "Owner" : "Co-organizer"}
                </span>
                {owner && !m.owner && (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Remove ${m.name}`}
                    title="Remove"
                    onClick={() => setConfirm({ kind: "remove", member: m })}
                  >
                    <X />
                  </Button>
                )}
                {!owner && m.userId === meId && (
                  <Button size="sm" variant="ghost" onClick={() => setConfirm({ kind: "leave" })}>
                    <LogOut />
                    Leave
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>

        {owner && pending.length > 0 && (
          <section className="rounded-2xl border border-line bg-surface">
            <h2 className="border-b border-line px-5 py-3 text-sm font-semibold text-bone">
              Waiting to accept · {pending.length}
            </h2>
            <ul className="divide-y divide-line">
              {pending.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-umber/40 text-brass">
                    <Mail className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-bone">{p.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Invited {new Date(p.createdAt).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button size="icon-sm" variant="ghost" aria-label={`Options for ${p.email}`} disabled={pendingAction}>
                          <MoreHorizontal />
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => run(() => resendCoOrganizerInviteAction(tournamentId, p.id), `Invite sent again to ${p.email}`)}
                      >
                        <Send />
                        Resend
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => run(() => cancelCoOrganizerInviteAction(tournamentId, p.id), "Invite cancelled")}
                      >
                        <X />
                        Cancel invite
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <aside className="h-fit rounded-2xl border border-umber bg-espresso p-5">
        <h2 className="font-semibold text-bone">What co-organizers can do</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {CAN.map((c) => (
            <li key={c} className="flex gap-2 text-bone/85">
              <Check className="mt-0.5 size-4 shrink-0 text-brass" />
              {c}
            </li>
          ))}
          {CANT.map((c) => (
            <li key={c} className="flex gap-2 text-muted-foreground">
              <X className="mt-0.5 size-4 shrink-0" />
              {c}
            </li>
          ))}
        </ul>
      </aside>

      {owner && (
        <InviteDialog
          open={inviting}
          onOpenChange={setInviting}
          tournamentId={tournamentId}
          link={link}
          appUrl={appUrl}
        />
      )}

      <Dialog open={confirm !== null} onOpenChange={(o) => !o && !pendingAction && setConfirm(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogTitle>{confirm?.kind === "remove" ? `Remove ${confirm.member.name}?` : "Leave this event?"}</DialogTitle>
          <DialogDescription>
            {confirm?.kind === "remove"
              ? "They lose access to this event right away. You can invite them again any time."
              : "You'll lose access to this event's organizer tools. The owner can invite you again."}
          </DialogDescription>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" disabled={pendingAction} onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={pendingAction}
              onClick={() => {
                if (!confirm) return;
                if (confirm.kind === "remove") {
                  run(
                    () => removeCoOrganizerAction(tournamentId, confirm.member.userId),
                    `${confirm.member.name} removed`,
                    () => setConfirm(null)
                  );
                } else {
                  startTransition(async () => {
                    const res = await leaveEventAction(tournamentId);
                    if (res.error) {
                      toast.error(res.error);
                      return;
                    }
                    toast.success("You left the event");
                    router.push("/organizer/tournaments");
                  });
                }
              }}
            >
              {pendingAction && <Loader2 className="animate-spin" />}
              {confirm?.kind === "remove" ? "Remove" : "Leave"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InviteDialog({
  open,
  onOpenChange,
  tournamentId,
  link,
  appUrl,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  tournamentId: string;
  link: string | null;
  appUrl: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sending, startSend] = useTransition();
  const [linkBusy, startLink] = useTransition();
  const [copied, setCopied] = useState(false);
  const url = link ? `${appUrl}/join/${link}` : null;

  function send(e: React.FormEvent) {
    e.preventDefault();
    startSend(async () => {
      const res = await inviteCoOrganizerAction(tournamentId, email);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`Invite sent to ${email.trim()}`);
      setEmail("");
      router.refresh();
    });
  }

  function toggleLink(on: boolean) {
    startLink(async () => {
      const res = await setInviteLinkAction(tournamentId, on);
      if (res.error) toast.error(res.error);
      else toast.success(on ? (link ? "New link created — the old one stopped working" : "Invite link is on") : "Invite link turned off");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden border border-umber bg-espresso p-0 sm:max-w-md">
        <div className="border-b border-line px-5 pt-5 pb-4">
          <DialogTitle className="text-base text-bone">Invite co-organizer</DialogTitle>
          <DialogDescription>They can run this event with you. Payouts stay with you.</DialogDescription>
        </div>

        <form onSubmit={send} className="space-y-3 border-b border-line px-5 py-5">
          <Label htmlFor="co-email" className="flex items-center gap-2">
            <Mail className="size-4 text-brass" />
            By email
          </Label>
          <div className="flex gap-2">
            <Input
              id="co-email"
              type="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@email.com"
              autoFocus
            />
            <Button type="submit" disabled={sending || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())}>
              {sending ? <Loader2 className="animate-spin" /> : <Send />}
              Send
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            They get an email with an Accept button. No account yet? They can create one from the email.
          </p>
        </form>

        <div className="space-y-3 px-5 py-5">
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-sm font-medium text-bone">
              <Link2 className="size-4 text-brass" />
              Or share a link
            </p>
            <label className="relative inline-flex shrink-0 cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(link)}
                disabled={linkBusy}
                onChange={(e) => toggleLink(e.target.checked)}
                className="peer sr-only"
                aria-label="Invite link"
              />
              <span className="h-6 w-11 rounded-full bg-surface-2 ring-1 ring-line transition-colors peer-checked:bg-bone" />
              <span className="absolute top-1 left-1 size-4 rounded-full bg-bone/70 transition-all peer-checked:translate-x-5 peer-checked:bg-ink" />
            </label>
          </div>
          {url ? (
            <>
              <div className="flex gap-2">
                <Input readOnly value={url} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(url);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    } catch {
                      toast.error("Could not copy");
                    }
                  }}
                >
                  {copied ? <Check /> : <Copy />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">Anyone signed in with this link can join.</p>
                <Button type="button" size="sm" variant="ghost" disabled={linkBusy} onClick={() => toggleLink(true)}>
                  <RefreshCw className="size-3.5" />
                  New link
                </Button>
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              Turn on to get a link you can paste in Messenger or Viber. Turn it off any time.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
