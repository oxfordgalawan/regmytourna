"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import {
  Shield,
  ClipboardList,
  CreditCard,
  Loader2,
  Repeat,
  Swords,
  Ticket,
  Trophy,
  UserRound,
  Wallet,
} from "lucide-react";
import { toast } from "@/lib/ui/app-toast";
import { enableRoleAction } from "@/app/actions/role";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AppRole } from "@/lib/auth/role";
import { cn } from "@/lib/utils";

const LANDING_KEY = "rmt-role-switch";
const WIPE_MS = 900;

/** Where a switch can take you: the two apps, or the super-admin console. */
export type SwitchKind = AppRole | "admin";

const KIND: Record<SwitchKind, { word: string; icon: typeof Trophy }> = {
  player: { word: "Player", icon: UserRound },
  organizer: { word: "Organizer", icon: Trophy },
  admin: { word: "Admin", icon: Shield },
};

const COPY: Record<AppRole, { title: string; perks: Array<[typeof Trophy, string]>; confirm: string; word: string }> = {
  organizer: {
    title: "Become an organizer?",
    perks: [
      [Trophy, "Create tournaments and categories"],
      [ClipboardList, "Take entries, run the draw and umpires"],
      [Wallet, "Collect entry fees into your wallet"],
    ],
    confirm: "Yes, make me an organizer",
    word: "Organizer",
  },
  player: {
    title: "Become a player?",
    perks: [
      [Ticket, "Join tournaments in a couple of taps"],
      [Swords, "Track your entries, matches and results"],
      [CreditCard, "Pay online or at the venue"],
    ],
    confirm: "Yes, make me a player",
    word: "Player",
  },
};

/** Full-screen colour wipe with the role's name; `phase` picks entering or revealing. */
function SwitchOverlay({ role, x, y, phase }: { role: SwitchKind; x: number; y: number; phase: "wipe" | "reveal" }) {
  const Icon = KIND[role].icon;
  return createPortal(
    <div
      aria-live="assertive"
      className="grain fixed inset-0 z-[300] flex flex-col items-center justify-center gap-5 bg-umber"
      style={
        {
          "--wipe-x": `${x}px`,
          "--wipe-y": `${y}px`,
          animation:
            phase === "wipe"
              ? `role-wipe-in ${WIPE_MS - 250}ms cubic-bezier(0.7,0,0.2,1) both`
              : "role-reveal-out 900ms cubic-bezier(0.6,0,0.2,1) both",
        } as React.CSSProperties
      }
    >
      <div className="court-grid pointer-events-none absolute inset-0 opacity-40" />
      <span
        className="relative flex size-16 items-center justify-center rounded-2xl bg-bone text-ink"
        style={{ animation: "role-word-up 500ms 180ms cubic-bezier(0.2,0.8,0.2,1) both" }}
      >
        <Icon className="size-8" />
      </span>
      <p
        className="display relative text-[clamp(3.5rem,14vw,9rem)] leading-none text-bone"
        style={{ animation: "role-word-up 600ms 260ms cubic-bezier(0.2,0.8,0.2,1) both" }}
      >
        {KIND[role].word}
      </p>
      <p className="eyebrow relative text-bone/70" style={{ animation: "role-word-up 500ms 380ms both" }}>
        {phase === "wipe" ? "Switching view" : "Welcome"}
      </p>
    </div>,
    document.body
  );
}

/** Plays the reveal half of the animation after a switch lands on the new page. */
export function RoleSwitchLanding() {
  const [landing, setLanding] = useState<SwitchKind | null>(null);
  useEffect(() => {
    const role = sessionStorage.getItem(LANDING_KEY) as SwitchKind | null;
    if (!role || !(role in KIND)) return;
    sessionStorage.removeItem(LANDING_KEY);
    const show = window.setTimeout(() => setLanding(role), 0);
    const hide = window.setTimeout(() => setLanding(null), 950);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
    };
  }, []);
  if (!landing) return null;
  return <SwitchOverlay role={landing} x={0} y={0} phase="reveal" />;
}

/**
 * Plays the wipe, then does a full page load to `href` (so server redirects
 * like /view/* can set cookies). The next page plays the reveal.
 */
export function useSwitchTransition() {
  const [wipe, setWipe] = useState<{ kind: SwitchKind; x: number; y: number } | null>(null);
  function go(kind: SwitchKind, href: string, at: { x: number; y: number }) {
    setWipe({ kind, ...at });
    sessionStorage.setItem(LANDING_KEY, kind);
    // full page load on purpose so server redirects (e.g. /view/*) can set cookies
    window.setTimeout(() => window.location.assign(href), WIPE_MS);
  }
  const overlay = wipe ? <SwitchOverlay role={wipe.kind} x={wipe.x} y={wipe.y} phase="wipe" /> : null;
  return { go, overlay };
}

/** An animated link to another app view or the admin console. */
export function SwitchLink({
  kind,
  href,
  label,
  compact = false,
  className,
}: {
  kind: SwitchKind;
  href: string;
  label: string;
  compact?: boolean;
  className?: string;
}) {
  const { go, overlay } = useSwitchTransition();
  const Icon = KIND[kind].icon;
  return (
    <>
      <button
        type="button"
        onClick={(e) => go(kind, href, { x: e.clientX, y: e.clientY })}
        className={cn(
          compact
            ? "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-umber/60 bg-umber/10 px-3 py-1.5 text-xs text-bone active:scale-95"
            : "group flex w-full items-center justify-between gap-2 rounded-lg border border-umber/60 bg-umber/10 px-3 py-2.5 text-left text-sm font-medium text-bone transition-colors hover:border-brass hover:bg-umber/25",
          className
        )}
      >
        <span className="flex items-center gap-2">
          <Icon className={cn("text-brass", compact ? "size-3.5" : "size-4")} aria-hidden />
          {label}
        </span>
        {!compact && (
          <Repeat className="size-3.5 text-muted-foreground transition-transform duration-500 group-hover:rotate-180" aria-hidden />
        )}
      </button>
      {overlay}
    </>
  );
}

/**
 * Switch between the player and organizer apps. If the user doesn't have the
 * other role yet, ask first ("Become an organizer?") and switch it on.
 */
export function RoleSwitch({ to, enabled, compact = false }: { to: AppRole; enabled: boolean; compact?: boolean }) {
  const [asking, setAsking] = useState(false);
  const [pending, startTransition] = useTransition();
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  const { go, overlay } = useSwitchTransition();

  // full page load on purpose: /view/* sets the view cookie on the server
  const play = (at: { x: number; y: number }) => go(to, `/view/${to}`, at);

  function onClick(e: React.MouseEvent) {
    const at = { x: e.clientX, y: e.clientY };
    if (enabled) return play(at);
    setOrigin(at);
    setAsking(true);
  }

  function confirm() {
    startTransition(async () => {
      const res = await enableRoleAction(to);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setAsking(false);
      play(origin);
    });
  }

  const label = to === "organizer" ? (enabled ? "Organizer view" : "Become an organizer") : enabled ? "Player view" : "Become a player";
  const Icon = to === "organizer" ? Trophy : UserRound;

  return (
    <>
      {compact ? (
        <button
          type="button"
          onClick={onClick}
          className="inline-flex items-center gap-1.5 rounded-full border border-umber/60 bg-umber/10 px-3 py-1.5 text-xs text-bone active:scale-95"
        >
          <Repeat className="size-3.5 text-brass" />
          {label}
        </button>
      ) : (
        <button
          type="button"
          onClick={onClick}
          className={cn(
            "group flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left text-sm font-medium text-bone transition-colors",
            "border-umber/60 bg-umber/10 hover:border-brass hover:bg-umber/25"
          )}
        >
          <span className="flex items-center gap-2">
            <Icon className="size-4 text-brass" aria-hidden />
            {label}
          </span>
          <Repeat className="size-3.5 text-muted-foreground transition-transform duration-500 group-hover:rotate-180" aria-hidden />
        </button>
      )}

      <Dialog open={asking} onOpenChange={(open) => !pending && setAsking(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <span className="mb-2 flex size-12 items-center justify-center rounded-2xl bg-umber text-brass">
              <Icon className="size-6" />
            </span>
            <DialogTitle className="display text-3xl text-bone">{COPY[to].title}</DialogTitle>
            <DialogDescription>
              You&apos;ll be both a player and an organizer, and can switch between them any time.
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-2.5">
            {COPY[to].perks.map(([PerkIcon, text]) => (
              <li key={text} className="flex items-center gap-3 rounded-xl border border-line bg-ink/30 px-3 py-2.5 text-sm text-bone/85">
                <PerkIcon className="size-4 shrink-0 text-brass" />
                {text}
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAsking(false)} disabled={pending}>
              Not now
            </Button>
            <Button onClick={confirm} disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              {COPY[to].confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {overlay}
    </>
  );
}

/**
 * Super-admin view switcher: one pill with both apps side by side
 * (⇄ Player | Organizer) instead of two separate buttons.
 */
export function ViewSwitcher({ compact = false }: { compact?: boolean }) {
  const { go, overlay } = useSwitchTransition();
  const options: Array<{ kind: AppRole; label: string }> = [
    { kind: "player", label: "Player" },
    { kind: "organizer", label: "Organizer" },
  ];
  return (
    <>
      <div
        className={cn(
          "flex items-center rounded-full border border-umber/60 bg-umber/10 p-1",
          compact ? "w-fit text-xs" : "w-full text-sm"
        )}
        role="group"
        aria-label="Switch view"
      >
        <span className={cn("flex shrink-0 items-center text-brass", compact ? "px-2" : "px-2.5")} aria-hidden>
          <Repeat className={compact ? "size-3.5" : "size-4"} />
        </span>
        {options.map((o) => {
          const Icon = KIND[o.kind].icon;
          return (
            <button
              key={o.kind}
              type="button"
              onClick={(e) => go(o.kind, `/view/${o.kind}`, { x: e.clientX, y: e.clientY })}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-full font-medium text-bone/85 transition-colors hover:bg-umber/40 hover:text-bone active:scale-95",
                compact ? "px-3 py-1" : "px-3 py-1.5"
              )}
            >
              <Icon className={cn("text-brass", compact ? "size-3.5" : "size-4")} aria-hidden />
              {o.label}
            </button>
          );
        })}
      </div>
      {overlay}
    </>
  );
}
