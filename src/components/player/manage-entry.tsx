"use client";

import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronRight,
  Clock,
  Info,
  Loader2,
  Lock,
  LogOut,
  Repeat2,
  Settings2,
  UserRoundPlus,
  UserX,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  cancelOurEntryAction,
  changeMyPartnerAction,
  inviteSubstituteAction,
  leaveTeamAction,
  resendSubstituteAction,
  withdrawSubstituteAction,
} from "@/app/actions/team-changes";
import { PlayerAvatar } from "@/components/players/player-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { formatPhp } from "@/lib/format";
import type { PlayerEntry } from "@/lib/player/entries";
import { cn } from "@/lib/utils";

type Step = "menu" | "change" | "substitute" | "leave" | "cancel";
type Done = { ok?: true; error?: string };

/**
 * Everything a player can do to their team, in one place: change partner,
 * find a substitute, leave, or cancel. Also shows the "your partner left"
 * banner and a pending substitute invite right on the ticket.
 */
export function ManageEntry({ entry: e, className }: { entry: PlayerEntry; className?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("menu");
  const [pending, startTransition] = useTransition();

  const active = !["cancelled", "refunded"].includes(e.status);
  if (!active) return null;

  const captain = e.isRegistrant;
  const mate = e.players.find((p) => !p.me) ?? null;
  const paid = e.paymentStatus === "paid";
  const sub = e.pendingSubstitute;

  function show(s: Step) {
    setStep(s);
    setOpen(true);
  }

  function run(action: () => Promise<Done>, success: string, close = true) {
    startTransition(async () => {
      const res = await action();
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(success);
      if (close) setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* the captain was left alone: keep the slot or let it go */}
      {e.needsPartner && captain && !e.locked && (
        <div className="rounded-xl border border-[#e58a72]/40 bg-[#e58a72]/[0.07] p-3.5 animate-rise">
          <p className="flex items-center gap-2 text-sm font-semibold text-bone">
            <UserX className="size-4 text-[#e58a72]" />
            Your partner left the team
          </p>
          <p className="mt-1 text-xs leading-relaxed text-bone/70">
            Your {paid ? "paid " : ""}slot is still held. Invite a new partner to keep playing, or cancel the slot.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => show("change")}>
              <UserRoundPlus />
              Invite a partner
            </Button>
            <Button size="sm" variant="ghost" onClick={() => show("cancel")}>
              Cancel slot
            </Button>
          </div>
        </div>
      )}

      {/* waiting on someone to take my place */}
      {sub?.mine && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-brass/40 bg-brass/[0.06] px-3.5 py-2.5 text-xs">
          <Clock className="size-3.5 shrink-0 text-brass" />
          <span className="min-w-0 flex-1 text-bone/85">
            Waiting for <span className="font-semibold text-bone">{sub.name}</span> to take your place
          </span>
          <span className="flex gap-3">
            <button
              type="button"
              disabled={pending}
              className="text-bone underline underline-offset-4 disabled:opacity-50"
              onClick={() => run(() => resendSubstituteAction(e.id), `Invite sent again to ${sub.email}`, false)}
            >
              Resend
            </button>
            <button
              type="button"
              disabled={pending}
              className="text-muted-foreground underline underline-offset-4 hover:text-bone disabled:opacity-50"
              onClick={() => run(() => withdrawSubstituteAction(e.id), "Invite withdrawn", false)}
            >
              Withdraw
            </button>
          </span>
        </div>
      )}

      <Button size="sm" variant="outline" onClick={() => show("menu")}>
        <Settings2 />
        Manage entry
      </Button>

      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent
          className={cn(
            "gap-0 overflow-hidden border border-umber bg-espresso p-0 sm:max-w-lg",
            // a bottom sheet on phones
            "max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:w-full max-sm:max-w-full max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none max-sm:pb-[env(safe-area-inset-bottom)]"
          )}
        >
          <div className="max-h-[85dvh] overflow-y-auto">
            {/* header */}
            <div className="flex items-center gap-3 border-b border-line px-5 pt-5 pb-4">
              {step !== "menu" ? (
                <button
                  type="button"
                  onClick={() => setStep("menu")}
                  className="flex size-9 shrink-0 items-center justify-center rounded-full border border-line text-bone hover:border-umber"
                  aria-label="Back"
                >
                  <ArrowLeft className="size-4" />
                </button>
              ) : (
                <div className="flex shrink-0 -space-x-3">
                  {e.players.map((p) => (
                    <PlayerAvatar key={p.name} name={p.name} src={p.avatarUrl} className="size-10 text-xs" />
                  ))}
                </div>
              )}
              <div className="min-w-0 pr-6">
                <DialogTitle className="truncate text-base text-bone">
                  {
                    {
                      menu: "Manage entry",
                      change: e.needsPartner ? "Invite a new partner" : "Change my partner",
                      substitute: "Find someone to take my place",
                      leave: "Leave the team",
                      cancel: e.doubles ? "Cancel our entry" : "Cancel my entry",
                    }[step]
                  }
                </DialogTitle>
                <DialogDescription className="truncate">
                  {e.categoryName} · {e.tournament.name}
                </DialogDescription>
              </div>
            </div>

            <div key={step} className="animate-rise px-5 py-5">
              {e.locked ? (
                <Locked slug={e.tournament.slug} />
              ) : step === "menu" ? (
                <div className="space-y-2">
                  {captain && e.doubles && (
                    <Option
                      icon={<Repeat2 />}
                      title={e.needsPartner ? "Invite a new partner" : "Change my partner"}
                      body={
                        e.needsPartner
                          ? "Add a partner to keep your slot."
                          : `Swap ${mate?.name ?? "your partner"} for someone else. Takes effect right away.`
                      }
                      onClick={() => setStep("change")}
                    />
                  )}
                  {!e.needsPartner && !sub && (
                    <Option
                      icon={<UserRoundPlus />}
                      title="Find someone to take my place"
                      body="Invite a friend. You stay on the team until they accept."
                      onClick={() => setStep("substitute")}
                    />
                  )}
                  {sub && !sub.mine && (
                    <p className="rounded-xl border border-line px-4 py-3 text-xs text-muted-foreground">
                      {mate?.name ?? "Your partner"} asked {sub.name} to take their place. You&apos;ll get an email when
                      they answer.
                    </p>
                  )}
                  {e.doubles && mate && (
                    <Option
                      icon={<LogOut />}
                      title="I can't play — leave the team"
                      body={`${mate.name} keeps the slot and gets an email to find a new partner.`}
                      onClick={() => setStep("leave")}
                    />
                  )}
                  {(captain || !e.doubles) && (
                    <Option
                      icon={<XCircle />}
                      title={e.doubles ? (mate ? "Cancel our entry" : "Cancel the slot") : "Cancel my entry"}
                      body="Releases the slot so the next team on the waitlist can play."
                      danger
                      onClick={() => setStep("cancel")}
                    />
                  )}
                </div>
              ) : step === "change" ? (
                <PersonForm
                  intro={
                    e.needsPartner
                      ? "We'll email them that they're on your team."
                      : `${mate?.name ?? "Your current partner"} will be removed and told by email. Your payment and slot stay the same.`
                  }
                  submitLabel={e.needsPartner ? "Add partner" : "Change partner"}
                  pending={pending}
                  emailOptional
                  onSubmit={(p) =>
                    run(() => changeMyPartnerAction(e.id, p), p.email ? `${p.name} is your partner — we've emailed them.` : `${p.name} is your partner.`)
                  }
                />
              ) : step === "substitute" ? (
                <PersonForm
                  intro={`We'll email them an invite. You stay on the team until they accept — then they take your place${
                    mate ? ` next to ${mate.name}` : ""
                  }.`}
                  submitLabel="Send invite"
                  pending={pending}
                  onSubmit={(p) => run(() => inviteSubstituteAction(e.id, p), `Invite sent to ${p.email}`)}
                />
              ) : step === "leave" ? (
                <Confirm
                  points={[
                    "You'll be removed from the team right away.",
                    `${mate?.name ?? "Your partner"} keeps the slot and gets an email to invite a new partner or cancel.`,
                    ...(paid ? [`The ${formatPhp(e.feeCents)} entry fee is non-refundable.`] : []),
                  ]}
                  hint="Rather hand your spot to a friend? Use “Find someone to take my place” instead."
                  confirmLabel="Leave the team"
                  pending={pending}
                  onConfirm={() =>
                    run(() => leaveTeamAction(e.id), "You've left the team. We've let your partner know.")
                  }
                />
              ) : (
                <Confirm
                  points={[
                    "Your slot is released to the next team on the waitlist.",
                    ...(e.doubles && mate ? [`${mate.name} will be told by email.`] : []),
                    ...(paid ? [`The ${formatPhp(e.feeCents)} entry fee is non-refundable.`] : []),
                  ]}
                  confirmLabel={e.doubles && mate ? "Cancel our entry" : "Cancel entry"}
                  typeToConfirm={paid ? e.categoryName : undefined}
                  danger
                  pending={pending}
                  onConfirm={() => run(() => cancelOurEntryAction(e.id), "Entry cancelled.")}
                />
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Option({
  icon,
  title,
  body,
  onClick,
  danger = false,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex w-full items-center gap-3.5 rounded-xl border border-line bg-surface px-4 py-3.5 text-left transition-colors hover:border-umber hover:bg-ink/40",
        danger && "hover:border-[#e58a72]/50"
      )}
    >
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-xl [&_svg]:size-5",
          danger ? "bg-[#e58a72]/10 text-[#e58a72]" : "bg-umber/40 text-brass"
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block text-sm font-semibold", danger ? "text-[#e58a72]" : "text-bone")}>{title}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{body}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}

function PersonForm({
  intro,
  submitLabel,
  pending,
  emailOptional = false,
  onSubmit,
}: {
  intro: string;
  submitLabel: string;
  pending: boolean;
  emailOptional?: boolean;
  onSubmit: (p: { name: string; email: string }) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const ready = name.trim().length >= 2 && (emailOptional || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()));
  return (
    <form
      className="space-y-4"
      onSubmit={(ev) => {
        ev.preventDefault();
        if (ready) onSubmit({ name: name.trim(), email: email.trim() });
      }}
    >
      <p className="text-sm leading-relaxed text-bone/75">{intro}</p>
      <div className="space-y-2">
        <Label htmlFor="mp-name">Full name</Label>
        <Input id="mp-name" value={name} onChange={(ev) => setName(ev.target.value)} autoComplete="off" autoFocus />
      </div>
      <div className="space-y-2">
        <Label htmlFor="mp-email">Email{emailOptional ? " (optional)" : ""}</Label>
        <Input
          id="mp-email"
          type="email"
          inputMode="email"
          value={email}
          onChange={(ev) => setEmail(ev.target.value)}
          autoComplete="off"
          placeholder="name@email.com"
        />
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={!ready || pending}>
        {pending && <Loader2 className="animate-spin" />}
        {submitLabel}
      </Button>
    </form>
  );
}

function Confirm({
  points,
  hint,
  confirmLabel,
  typeToConfirm,
  danger = false,
  pending,
  onConfirm,
}: {
  points: string[];
  hint?: string;
  confirmLabel: string;
  typeToConfirm?: string;
  danger?: boolean;
  pending: boolean;
  onConfirm: () => void;
}) {
  const [typed, setTyped] = useState("");
  const ok = !typeToConfirm || typed.trim().toLowerCase() === typeToConfirm.trim().toLowerCase();
  return (
    <div className="space-y-4">
      <ul className="space-y-2.5">
        {points.map((pt) => (
          <li key={pt} className="flex gap-2.5 text-sm leading-relaxed text-bone/85">
            <Info className="mt-0.5 size-4 shrink-0 text-brass" />
            {pt}
          </li>
        ))}
      </ul>
      {hint && <p className="rounded-xl border border-line bg-ink/40 px-3.5 py-2.5 text-xs text-muted-foreground">{hint}</p>}
      {typeToConfirm && (
        <div className="space-y-2">
          <Label htmlFor="mp-confirm" className="text-xs text-muted-foreground">
            Type <span className="font-semibold text-bone">{typeToConfirm}</span> to confirm
          </Label>
          <Input id="mp-confirm" value={typed} onChange={(ev) => setTyped(ev.target.value)} autoComplete="off" />
        </div>
      )}
      <Button
        size="lg"
        variant={danger ? "destructive" : "default"}
        className="w-full"
        disabled={!ok || pending}
        onClick={onConfirm}
      >
        {pending && <Loader2 className="animate-spin" />}
        {confirmLabel}
      </Button>
    </div>
  );
}

function Locked({ slug }: { slug: string }) {
  return (
    <div className="space-y-4 text-center">
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-umber/40 text-brass">
        <Lock className="size-5" />
      </span>
      <div>
        <p className="font-semibold text-bone">Changes are locked</p>
        <p className="mt-1 text-sm text-muted-foreground">
          The draw for this category has started. Ask the organizer — send a petition from the category&apos;s entries
          list.
        </p>
      </div>
      <Button asChild>
        <Link href={`/tournaments/${slug}#entries`}>Request a change</Link>
      </Button>
    </div>
  );
}
