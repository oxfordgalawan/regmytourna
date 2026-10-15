"use client";

import { useState } from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** Opens a fresh PayMongo checkout for an unpaid entry. */
export function PayNowButton({ registrationId, label = "Pay now" }: { registrationId: string; label?: string }) {
  const [loading, setLoading] = useState(false);

  async function pay() {
    setLoading(true);
    try {
      const res = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationId }),
      });
      const json = (await res.json()) as { checkoutUrl?: string; error?: string };
      if (!res.ok || !json.checkoutUrl) throw new Error(json.error ?? "Couldn't start checkout");
      window.location.href = json.checkoutUrl;
    } catch (e) {
      setLoading(false);
      toast.error(e instanceof Error ? e.message : "Couldn't start checkout");
    }
  }

  return (
    <Button size="sm" onClick={pay} disabled={loading}>
      {loading ? <Loader2 className="animate-spin" /> : <CreditCard />}
      {label}
    </Button>
  );
}
