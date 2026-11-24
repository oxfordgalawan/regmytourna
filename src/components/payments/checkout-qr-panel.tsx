"use client";

import { useEffect, useState } from "react";
import { Check, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "@/lib/ui/app-toast";
import { getMyRegistrationPaymentStatusAction } from "@/app/actions/registrations";
import { PaymentHoldTimer } from "@/components/tournaments/payment-hold-timer";
import { Button } from "@/components/ui/button";
import { formatPhp } from "@/lib/format";
import { qrContentToDataUrl } from "@/lib/payments/qrph-image";
import {
  QRPH_DESK_COMPATIBILITY_NOTE,
  QRPH_DESK_SCAN_REMINDER,
} from "@/lib/payments/qrph-desk-copy";

export function CheckoutQrPanel({
  qrImageUrl,
  checkoutUrl,
  registrationId,
  amountCents,
  currency = "PHP",
  paymentHoldExpiresAt,
  qrExpiresAt,
  onPaid,
  onHoldExpired,
}: {
  qrImageUrl: string;
  checkoutUrl?: string | null;
  registrationId: string;
  amountCents: number;
  currency?: string;
  paymentHoldExpiresAt?: string | null;
  qrExpiresAt?: string | null;
  onPaid?: () => void;
  onHoldExpired?: () => void;
}) {
  const [qr, setQr] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);
  const [holdExpired, setHoldExpired] = useState(false);
  const [browserCheckoutUrl, setBrowserCheckoutUrl] = useState(checkoutUrl?.trim() || "");

  useEffect(() => {
    setBrowserCheckoutUrl(checkoutUrl?.trim() || "");
  }, [checkoutUrl]);

  useEffect(() => {
    let cancelled = false;
    void qrContentToDataUrl(qrImageUrl).then((url) => {
      if (!cancelled) setQr(url);
    });
    return () => {
      cancelled = true;
    };
  }, [qrImageUrl]);

  useEffect(() => {
    if (paid || holdExpired) return;
    const id = window.setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      const res = await getMyRegistrationPaymentStatusAction(registrationId);
      if ("error" in res && res.error) return;
      if ("expired" in res && res.expired) {
        setHoldExpired(true);
        onHoldExpired?.();
        return;
      }
      if (res.paid) {
        setPaid(true);
        onPaid?.();
      }
    }, 3000);
    return () => window.clearInterval(id);
  }, [paid, holdExpired, registrationId, onPaid, onHoldExpired]);

  async function openBrowserCheckout() {
    if (browserCheckoutUrl) {
      window.open(browserCheckoutUrl, "_blank", "noopener,noreferrer");
      return;
    }
    try {
      const res = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationId }),
      });
      const json = (await res.json()) as { checkoutUrl?: string; qrImageUrl?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Couldn't open checkout");
      if (json.checkoutUrl) {
        setBrowserCheckoutUrl(json.checkoutUrl);
        window.open(json.checkoutUrl, "_blank", "noopener,noreferrer");
      } else {
        throw new Error("Browser checkout isn't available — try scanning the QR.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't open checkout");
    }
  }

  const holdDeadline = paymentHoldExpiresAt ?? qrExpiresAt ?? null;

  if (holdExpired) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <p className="display text-2xl text-bone">Time&apos;s up</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Your slot was released because payment wasn&apos;t received within 30 minutes. You can try again if a slot is
          still open.
        </p>
      </div>
    );
  }

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
      {holdDeadline && (
        <p className="text-sm text-bone/80">
          Complete payment within{" "}
          <PaymentHoldTimer
            expiresAt={holdDeadline}
            onExpire={() => {
              setHoldExpired(true);
              onHoldExpired?.();
            }}
          />
        </p>
      )}
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
      <Button type="button" variant="outline" size="sm" onClick={() => void openBrowserCheckout()}>
        <ExternalLink className="size-4" />
        Open checkout in browser
      </Button>
      <p className="text-xs text-muted-foreground">Use this for card or GCash in the browser.</p>
    </div>
  );
}