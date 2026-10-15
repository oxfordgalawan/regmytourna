"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { umpireSignInAction, umpireSignOutAction } from "@/app/actions/umpire";
import { UmpireQueue, type QueueMatch } from "@/components/umpire/umpire-queue";
import { UmpireBrackets } from "@/components/umpire/umpire-brackets";
import { PinEntry } from "@/components/umpire/pin-entry";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { DrawView } from "@/lib/draw/view";
import { NAV_FORWARD } from "@/lib/nav-transitions";
import { Button } from "@/components/ui/button";

export function UmpireHub({
  tournamentId,
  tournamentName,
  sessionUmpire,
  queueMatches,
  myMatches,
  bracketCategories,
}: {
  tournamentId: string;
  tournamentName: string;
  sessionUmpire: { id: string; name: string } | null;
  queueMatches: QueueMatch[];
  myMatches: QueueMatch[];
  bracketCategories: Array<{ id: string; name: string; view: DrawView }>;
}) {
  const router = useRouter();
  const [signInOpen, setSignInOpen] = useState(false);
  const [signInBusy, setSignInBusy] = useState(false);

  return (
    <div className="mx-auto max-w-3xl px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[calc(4rem+env(safe-area-inset-bottom))]">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow">Umpire hub</p>
          <h1 className="display mt-2 truncate text-4xl text-bone">{tournamentName}</h1>
          {sessionUmpire ? (
            <p className="mt-2 text-sm text-muted-foreground">Signed in as {sessionUmpire.name}</p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">View the queue and brackets — PIN required to claim or score.</p>
          )}
        </div>
        <div className="flex shrink-0 flex-col gap-2">
          {sessionUmpire ? (
            <button
              type="button"
              onClick={async () => {
                await umpireSignOutAction(tournamentId);
                router.refresh();
              }}
              className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs text-muted-foreground hover:text-bone"
            >
              <LogOut className="size-3.5" />
              Sign out
            </button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setSignInOpen(true)}>
              Sign in
            </Button>
          )}
        </div>
      </header>

      <Tabs defaultValue="queue" className="mt-8">
        <TabsList className="w-full">
          <TabsTrigger value="queue" className="flex-1">
            Queue
          </TabsTrigger>
          <TabsTrigger value="brackets" className="flex-1">
            Brackets
          </TabsTrigger>
          {sessionUmpire && (
            <TabsTrigger value="mine" className="flex-1">
              My matches
            </TabsTrigger>
          )}
        </TabsList>
        <TabsContent value="queue" className="mt-6">
          <UmpireQueue tournamentId={tournamentId} matches={queueMatches} />
        </TabsContent>
        <TabsContent value="brackets" className="mt-6">
          <UmpireBrackets tournamentId={tournamentId} categories={bracketCategories} />
        </TabsContent>
        {sessionUmpire && (
          <TabsContent value="mine" className="mt-6">
            {myMatches.length === 0 ? (
              <p className="text-sm text-muted-foreground">No matches assigned to you yet. Claim one from the queue.</p>
            ) : (
              <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
                {myMatches.map((m) => (
                  <li key={m.id} className="bg-surface p-4">
                    <p className="text-xs text-muted-foreground">{m.label}</p>
                    <p className="mt-1 font-medium text-bone">
                      {m.teamA} vs {m.teamB}
                    </p>
                    <Button size="sm" className="mt-3" asChild>
                      <Link href={`/umpire/${tournamentId}/match/${m.id}`} transitionTypes={NAV_FORWARD}>
                        {m.status === "in_progress" ? "Continue scoring" : "Open scoresheet"}
                      </Link>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        )}
      </Tabs>

      <Dialog open={signInOpen} onOpenChange={setSignInOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Sign in</DialogTitle>
            <DialogDescription>Use the PIN the organizer gave you.</DialogDescription>
          </DialogHeader>
          <PinEntry
            busy={signInBusy}
            label="Your 4-digit PIN"
            onSubmit={async (pin) => {
              setSignInBusy(true);
              const res = await umpireSignInAction(tournamentId, pin);
              setSignInBusy(false);
              if (res.error) return { error: res.error };
              setSignInOpen(false);
              router.refresh();
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
