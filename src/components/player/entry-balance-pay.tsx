"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Loader2 } from "lucide-react";
import { toast } from "@/lib/ui/app-toast";
import { CheckoutQrPanel } from "@/components/payments/checkout-qr-panel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatPhp } from "@/lib/format";

export function EntryBalancePay({
  registrationId,
  feeDueCents,
  paidCents,
  balanceDueCents,
}: {
  registrationId: string;
  feeDueCents: number;
  paidCents: number;
  balanceDueCents: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [qrExpiresAt, setQrExpiresAt] = useState<string | null>(null);
  const [amountCents, setAmountCents] = useState(balanceDueCents);

  async function startPay() {
    setLoading(true);
    try {
      const res = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationId }),
      });
      const json = (await res.json()) as {
        qrImageUrl?: string;
        checkoutUrl?: string;
        expiresAt?: string;
        amountCents?: number;
        error?: string;
      };
      if (!res.ok || !json.qrImageUrl) throw new Error(json.error ?? "Couldn't start checkout");
      setQrImageUrl(json.qrImageUrl);
      setCheckoutUrl(json.checkoutUrl ?? null);
      setQrExpiresAt(json.expiresAt ?? null);
      setAmountCents(json.amountCents ?? balanceDueCents);
      setOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't start checkout");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Paid {formatPhp(paidCents)} of {formatPhp(feeDueCents)} · balance {formatPhp(balanceDueCents)}
      </p>
      <Button size="sm" onClick={startPay} disabled={loading || balanceDueCents <= 0}>
        {loading ? <Loader2 className="animate-spin" /> : <CreditCard />}
        Pay {formatPhp(balanceDueCents)} balance
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Pay remaining entry fee</DialogTitle>
          </DialogHeader>
          {qrImageUrl ? (
            <CheckoutQrPanel
              registrationId={registrationId}
              qrImageUrl={qrImageUrl}
              checkoutUrl={checkoutUrl}
              amountCents={amountCents}
              qrExpiresAt={qrExpiresAt}
              onPaid={() => {
                setOpen(false);
                toast.success("Payment received — thank you!");
                router.refresh();
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}