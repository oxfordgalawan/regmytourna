"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Check, ExternalLink, Loader2 } from "lucide-react";
import { getMyRegistrationPaymentStatusAction } from "@/app/actions/registrations";
import { Button } from "@/components/ui/button";
import { formatPhp } from "@/lib/format";
import {
  QRPH_DESK_COMPATIBILITY_NOTE,
  QRPH_DESK_SCAN_REMINDER,
} from "@/lib/payments/qrph-desk-copy";

export function CheckoutQrPanel({
  checkoutUrl,
  registrationId,
  amountCents,
  currency = "PHP",
  onPaid,
}: {
  checkoutUrl: string;
  registrationId: string;
  amountCents: number;
  currency?: string;
  onPaid?: () => void;
}) {
  const [qr, setQr] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void QRCode.toDataURL(checkoutUrl, { width: 280, margin: 2 }).then((url) => {
      if (!cancelled) setQr(url);
    });
    return () => {
      cancelled = true;
    };
  }, [checkoutUrl]);

  useEffect(() => {
    if (paid) return;
    const id = window.setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      const res = await getMyRegistrationPaymentStatusAction(registrationId);
      if ("error" in res && res.error) return;
      if (res.paid) {
        setPaid(true);
        onPaid?.();
      }
    }, 3000);
    return () => window.clearInterval(id);
  }, [paid, registrationId, onPaid]);

  if (paid) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center animate-in zoom-in-95 fade-in-0">
        <span className="flex size-14 items-center justify-center rounded-full bg-bone text-ink">
          <Check className="size-7" strokeWidth={3} />
        </span>
        <p className="display text-3xl text-bone">You&apos;re in</p>
        <p className="text-sm text-muted-foreground">Payment received — your entry is confirmed.</p>
      </div>
    );
  }

  const amount = formatPhp(amountCents, currency);

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <p className="text-sm text-muted-foreground">
        Pay <span className="font-mono text-bone">{amount}</span> to confirm your slot
      </p>
      <div className="rounded-2xl bg-white p-3">
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt="Payment QR code" width={280} height={280} />
        ) : (
          <div className="flex size-[280px] items-center justify-center text-ink/60">
            <Loader2 className="animate-spin" />
          </div>
        )}
      </div>
      <p
        className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-left text-sm text-bone/90"
        role="note"
      >
        {QRPH_DESK_COMPATIBILITY_NOTE}
      </p>
      <p className="flex flex-col items-center gap-1 text-sm text-muted-foreground">
        <span className="flex items-center gap-2">
          <Loader2 className="size-3.5 animate-spin" />
          Waiting for payment — this updates by itself.
        </span>
        <span className="text-xs">{QRPH_DESK_SCAN_REMINDER}</span>
      </p>
      <Button type="button" variant="outline" size="sm" onClick={() => window.open(checkoutUrl, "_blank", "noopener,noreferrer")}>
        <ExternalLink className="size-4" />
        Open checkout in browser
      </Button>
      <p className="text-xs text-muted-foreground">Use this for card or GCash in the browser.</p>
    </div>
  );
}