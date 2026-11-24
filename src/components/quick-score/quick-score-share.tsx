"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function QuickScoreShare({
  open,
  onOpenChange,
  tvUrl,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tvUrl: string;
}) {
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    void QRCode.toDataURL(tvUrl, { width: 260, margin: 2, color: { dark: "#000000", light: "#ffffff" } }).then(setQr);
  }, [open, tvUrl]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(tvUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>TV scoreboard</DialogTitle>
          <DialogDescription>
            Open this link on the TV browser, or scan the QR code. Scores update every few seconds.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="TV scoreboard QR code" width={260} height={260} className="rounded-xl" />
          ) : null}
          <p className="w-full break-all rounded-lg border border-line bg-surface/80 px-3 py-2 font-mono text-xs text-muted-foreground">
            {tvUrl}
          </p>
          <Button type="button" variant="outline" className="w-full gap-2" onClick={() => void copy()}>
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? "Copied" : "Copy link"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}