"use client";

import { useTransition } from "react";
import { Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { startOrganizerActAsAction } from "@/app/actions/super-admin";
import { Button } from "@/components/ui/button";

export function ViewAsOrganizerButton({ organizerId }: { organizerId: string }) {
  const [pending, start] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await startOrganizerActAsAction(organizerId);
          if (res && "error" in res) toast.error(res.error);
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <Eye className="size-4" />}
      View as
    </Button>
  );
}
