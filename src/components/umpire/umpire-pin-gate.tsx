"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { umpireSignInAction } from "@/app/actions/umpire";
import { PinEntry } from "@/components/umpire/pin-entry";

/** First screen of the umpire link: sign in with your PIN before seeing any matches. */
export function UmpirePinGate({ tournamentId, tournamentName }: { tournamentId: string; tournamentName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <span className="mx-auto flex size-12 items-center justify-center rounded-full border border-line bg-surface">
        <ShieldCheck className="size-6 text-brass" />
      </span>
      <p className="eyebrow mt-5 text-center">Umpire sign-in</p>
      <h1 className="display mt-2 text-center text-4xl text-bone">{tournamentName}</h1>
      <p className="mt-2 text-center text-sm text-muted-foreground">
        Enter the 4-digit PIN the organizer gave you to see and score your matches.
      </p>
      <div className="mt-8 rounded-2xl border border-line bg-espresso/60 p-5">
        <PinEntry
          busy={busy}
          label="Your umpire PIN"
          onSubmit={async (pin) => {
            setBusy(true);
            const res = await umpireSignInAction(tournamentId, pin);
            if (res.error) {
              setBusy(false);
              return { error: res.error };
            }
            router.refresh();
          }}
        />
      </div>
      <p className="mt-6 text-center text-xs text-muted-foreground">Don&apos;t have a PIN? Ask the organizer at the desk.</p>
    </div>
  );
}
