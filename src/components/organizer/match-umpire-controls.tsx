"use client";

import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp } from "lucide-react";
import { toast } from "sonner";
import { assignMatchUmpireAction, bumpMatchQueueAction } from "@/app/actions/umpire";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function MatchUmpireControls({
  tournamentId,
  matchId,
  umpireId,
  umpires,
  status,
}: {
  tournamentId: string;
  matchId: string;
  umpireId: string | null;
  umpires: { id: string; name: string }[];
  status: string;
}) {
  const router = useRouter();

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {status === "scheduled" && (
        <>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Move up in queue"
            onClick={async () => {
              const res = await bumpMatchQueueAction(tournamentId, matchId, "up");
              if (res.error) toast.error(res.error);
              router.refresh();
            }}
          >
            <ArrowUp className="size-4" />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Move down in queue"
            onClick={async () => {
              const res = await bumpMatchQueueAction(tournamentId, matchId, "down");
              if (res.error) toast.error(res.error);
              router.refresh();
            }}
          >
            <ArrowDown className="size-4" />
          </Button>
        </>
      )}
      <Select
        value={umpireId ?? "none"}
        onValueChange={async (v) => {
          const res = await assignMatchUmpireAction(tournamentId, matchId, v === "none" ? null : v);
          if (res.error) toast.error(res.error);
          router.refresh();
        }}
      >
        <SelectTrigger className="h-8 w-[9rem]">
          <SelectValue placeholder="Umpire" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Unassigned</SelectItem>
          {umpires.map((u) => (
            <SelectItem key={u.id} value={u.id}>
              {u.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
