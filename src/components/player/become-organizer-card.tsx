"use client";

import { useTransition } from "react";
import { ClipboardList, Loader2, Trophy, Wallet } from "lucide-react";
import { toast } from "@/lib/ui/app-toast";
import { becomeOrganizerAction } from "@/app/actions/role";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Players can opt in to organizer tools here. */
export function BecomeOrganizerCard({ highlight = false }: { highlight?: boolean }) {
  const [pending, start] = useTransition();

  return (
    <div
      className={cn(
        "grain relative overflow-hidden rounded-2xl border p-6",
        highlight ? "border-brass bg-umber/30" : "border-umber bg-espresso"
      )}
    >
      {highlight && (
        <p className="mb-3 text-sm text-brass">Event tools and the wallet are for organizers. Turn them on below.</p>
      )}
      <h3 className="display text-3xl text-bone">Running a tournament?</h3>
      <ul className="mt-4 grid gap-2 text-sm text-bone/80 sm:grid-cols-3">
        {[
          [Trophy, "Create events & categories"],
          [ClipboardList, "Take entries & run the draw"],
          [Wallet, "Get paid to your wallet"],
        ].map(([Icon, text]) => {
          const I = Icon as typeof Trophy;
          return (
            <li key={text as string} className="flex items-center gap-2">
              <I className="size-4 shrink-0 text-brass" />
              {text as string}
            </li>
          );
        })}
      </ul>
      <Button
        className="mt-5"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await becomeOrganizerAction();
            if (res?.error) toast.error(res.error);
          })
        }
      >
        {pending && <Loader2 className="animate-spin" />}
        Start organizing
      </Button>
      <p className="mt-3 text-xs text-muted-foreground">You can still join tournaments as a player.</p>
    </div>
  );
}
