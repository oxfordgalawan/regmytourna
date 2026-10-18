"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Copy, Download } from "lucide-react";
import { toast } from "@/lib/ui/app-toast";
import { Button } from "@/components/ui/button";

export function RegistrationQrCard({
  registrationUrl,
  tournamentName,
  slug,
}: {
  registrationUrl: string;
  tournamentName: string;
  slug: string;
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(registrationUrl, {
      width: 280,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) toast.error("Could not generate QR code.");
      });
    return () => {
      cancelled = true;
    };
  }, [registrationUrl]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(registrationUrl);
      toast.success("Registration link copied");
    } catch {
      toast.error("Could not copy to clipboard");
    }
  }

  function downloadQr() {
    if (!qrDataUrl) return;
    const link = document.createElement("a");
    link.href = qrDataUrl;
    link.download = `regmytourna-register-${slug}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-6">
      <h2 className="font-semibold text-bone">Share registration</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Players scan to open registration for {tournamentName}.
      </p>
      <div className="mt-6 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <div className="rounded-xl bg-white p-3">
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrDataUrl} alt="Registration QR code" width={280} height={280} />
          ) : (
            <div className="flex size-[280px] items-center justify-center text-sm text-muted-foreground">
              Generating…
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <p className="break-all font-mono text-xs text-muted-foreground">{registrationUrl}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={copyLink}>
              <Copy />
              Copy link
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={downloadQr} disabled={!qrDataUrl}>
              <Download />
              Download PNG
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
