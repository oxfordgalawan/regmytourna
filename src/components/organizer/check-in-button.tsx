"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { checkInAction } from "@/app/actions/check-in";
import { Button } from "@/components/ui/button";

export function CheckInButton({
  tournamentId,
  registrationId,
  checkedIn = false,
}: {
  tournamentId: string;
  registrationId: string;
  checkedIn?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(checkedIn);

  async function checkIn() {
    setLoading(true);
    try {
      await checkInAction(tournamentId, registrationId);
    } catch {
      setLoading(false);
      toast.error("Couldn't check in this player. Try again.");
      return;
    }
    setLoading(false);
    setDone(true);
    router.refresh();
  }

  if (done) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-bone animate-in fade-in-0 zoom-in-95">
        <span className="flex size-5 items-center justify-center rounded-full bg-bone text-ink">
          <Check className="size-3" strokeWidth={3} />
        </span>
        Checked in
      </span>
    );
  }

  return (
    <Button size="sm" variant="outline" onClick={checkIn} disabled={loading}>
      {loading && <Loader2 className="animate-spin" />}
      Check in
    </Button>
  );
}
