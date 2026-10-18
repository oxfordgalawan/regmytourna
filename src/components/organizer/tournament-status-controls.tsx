"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "@/lib/ui/app-toast";
import { updateTournamentStatusAction } from "@/app/actions/tournaments";
import { Button } from "@/components/ui/button";
import type { TournamentStatus } from "@/types/database";

export function TournamentStatusControls({
  tournamentId,
  status,
  bracketOnly,
  size = "sm",
}: {
  tournamentId: string;
  status: TournamentStatus;
  bracketOnly: boolean;
  size?: "sm" | "default";
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function apply(next: TournamentStatus, message: string) {
    start(async () => {
      const res = await updateTournamentStatusAction(tournamentId, next);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(message);
      router.refresh();
    });
  }

  if (status === "draft") {
    return (
      <div className="flex flex-wrap gap-2">
        {!bracketOnly && (
          <Button
            type="button"
            variant="outline"
            size={size}
            disabled={pending}
            onClick={() => apply("registration_open", "Registration is open — players can sign up.")}
          >
            Open registration
          </Button>
        )}
        <Button
          type="button"
          variant="umber"
          size={size}
          disabled={pending}
          onClick={() =>
            apply(
              "published",
              bracketOnly ? "Event published — players can view brackets on the public page." : "Event announced — listed publicly, entries not open yet."
            )
          }
        >
          {pending ? <Loader2 className="animate-spin" /> : null}
          Publish event
        </Button>
      </div>
    );
  }

  if (status === "published" && !bracketOnly) {
    return (
      <Button
        type="button"
        variant="umber"
        size={size}
        disabled={pending}
        onClick={() => apply("registration_open", "Registration is open.")}
      >
        {pending ? <Loader2 className="animate-spin" /> : null}
        Open registration
      </Button>
    );
  }

  if (status === "registration_open") {
    return (
      <Button
        type="button"
        variant="outline"
        size={size}
        disabled={pending}
        onClick={() => apply("registration_closed", "Registration closed.")}
      >
        {pending ? <Loader2 className="animate-spin" /> : null}
        Close registration
      </Button>
    );
  }

  return null;
}

/** Checklist row: publish CTA when the event is still a draft. */
export function PublishChecklistAction({
  tournamentId,
  bracketOnly,
}: {
  tournamentId: string;
  bracketOnly: boolean;
}) {
  return (
    <div className="mt-1 pl-8">
      <TournamentStatusControls tournamentId={tournamentId} status="draft" bracketOnly={bracketOnly} size="sm" />
    </div>
  );
}
