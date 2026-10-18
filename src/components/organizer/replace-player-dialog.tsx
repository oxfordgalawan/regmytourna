"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock } from "lucide-react";
import { toast } from "@/lib/ui/app-toast";
import { replacePlayerAction } from "@/app/actions/organizer-players";
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
import { PlayerAvatar } from "@/components/players/player-avatar";
import { cn } from "@/lib/utils";

export type ReplaceTarget = {
  registrationId: string;
  division: string;
  /** desk walk-ins can swap either player; online entries only the partner */
  walkIn: boolean;
  players: Array<{ rowId: string; name: string; email: string | null; primary: boolean }>;
};

export function ReplacePlayerDialog({ target, onClose }: { target: ReplaceTarget; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const swappable = (p: ReplaceTarget["players"][number]) => target.walkIn || !p.primary;
  const first = target.players.find((p) => !p.primary && swappable(p)) ?? target.players.find(swappable);
  const [rowId, setRowId] = useState(first?.rowId ?? "");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const chosen = target.players.find((p) => p.rowId === rowId);

  function save() {
    startTransition(async () => {
      const res = await replacePlayerAction(target.registrationId, rowId, { name, email });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`${chosen?.name ?? "Player"} replaced by ${name.trim()}`);
      router.refresh();
      onClose();
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{target.walkIn ? "Replace a player" : "Replace partner"}</DialogTitle>
          <DialogDescription>
            {target.division} · the payment and slot stay with this entry, and drawn matches show the new name.
          </DialogDescription>
        </DialogHeader>

        <fieldset className="space-y-2">
          <legend className="eyebrow mb-2">Who&apos;s being replaced?</legend>
          {target.players.map((p) => {
            const can = swappable(p);
            const active = p.rowId === rowId;
            return (
              <button
                key={p.rowId}
                type="button"
                disabled={!can}
                onClick={() => setRowId(p.rowId)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
                  active ? "border-bone bg-bone/[0.06]" : "border-line hover:border-bone/30",
                  !can && "cursor-not-allowed opacity-50 hover:border-line"
                )}
              >
                <PlayerAvatar name={p.name} className="size-9 text-xs" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-bone">{p.name}</span>
                  <span className="block truncate font-mono text-[0.7rem] text-muted-foreground">
                    {p.email ?? "No email"}
                  </span>
                </span>
                {!can && (
                  <span className="flex items-center gap-1 text-[0.7rem] text-muted-foreground">
                    <Lock className="size-3" />
                    Registered online
                  </span>
                )}
              </button>
            );
          })}
        </fieldset>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rp-name">New player&apos;s full name</Label>
            <Input id="rp-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" autoFocus />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rp-email">Email (optional)</Label>
            <Input
              id="rp-email"
              type="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="off"
              placeholder="We'll send them the entry details"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" disabled={pending} onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={pending || !rowId || name.trim().length < 2} onClick={save}>
            {pending && <Loader2 className="animate-spin" />}
            Replace player
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
