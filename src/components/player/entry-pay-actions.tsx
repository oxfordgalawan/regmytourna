"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Info, Loader2, Store } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PayNowButton } from "@/components/player/pay-now-button";
import { choosePayAtVenueAction } from "@/app/actions/registrations";
import { formatPhp } from "@/lib/format";

/** Pay online now, or (if the event allows it) choose to pay at the venue. Always says it's non-refundable. */
export function EntryPayActions({
  registrationId,
  feeCents,
  allowPayAtVenue,
}: {
  registrationId: string;
  feeCents: number;
  allowPayAtVenue: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function payAtVenue() {
    startTransition(async () => {
      const res = await choosePayAtVenueAction(registrationId);
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Slot held — pay at the desk on event day.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <PayNowButton registrationId={registrationId} label={`Pay ${formatPhp(feeCents)} online`} />
        {allowPayAtVenue && (
          <Button size="sm" variant="outline" disabled={pending} onClick={payAtVenue}>
            {pending ? <Loader2 className="animate-spin" /> : <Store />}
            Pay at the venue
          </Button>
        )}
      </div>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Info className="size-3.5 shrink-0 text-brass" aria-hidden />
        Entry fees are non-refundable once paid.
      </p>
    </div>
  );
}
