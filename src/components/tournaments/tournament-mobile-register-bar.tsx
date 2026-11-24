"use client";

import { formatPhp } from "@/lib/format";
import {
  TournamentRegisterGuestAuth,
  TournamentRegisterNowLink,
} from "@/components/tournaments/tournament-register-guest-auth";
import { useRegisterFeeDisplay } from "@/components/tournaments/register-fee-context";

export function TournamentMobileRegisterBar({ isSignedIn }: { isSignedIn: boolean }) {
  const { feeCents, currency } = useRegisterFeeDisplay();

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md lg:hidden">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <div>
          <p className="eyebrow">{isSignedIn ? "Total due" : "Entry from"}</p>
          <p className="font-mono text-bone">{formatPhp(feeCents, currency)}</p>
        </div>
        {isSignedIn ? <TournamentRegisterNowLink /> : <TournamentRegisterGuestAuth variant="mobile" />}
      </div>
    </div>
  );
}