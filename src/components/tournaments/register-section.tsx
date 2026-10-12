"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Lock } from "lucide-react";
import { createRegistrationAction } from "@/app/actions/registrations";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatPhp } from "@/lib/format";
import { cn } from "@/lib/utils";

type Division = {
  id: string;
  name: string;
  format: string;
  entry_fee_cents?: number | null;
  capacity?: number | null;
};

export function RegisterSection({
  slug,
  divisions,
  currency = "PHP",
  defaultFeeCents = 0,
}: {
  slug: string;
  divisions: Division[];
  currency?: string;
  defaultFeeCents?: number;
}) {
  const router = useRouter();
  const [divisionId, setDivisionId] = useState(divisions[0]?.id ?? "");
  const [partnerEmail, setPartnerEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const selected = divisions.find((d) => d.id === divisionId);
  const fee = selected?.entry_fee_cents ?? defaultFeeCents;

  async function handleRegister() {
    if (!divisionId) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    const result = await createRegistrationAction({
      tournamentSlug: slug,
      divisionId,
      partnerEmail: selected?.format === "doubles" ? partnerEmail : undefined,
    });
    if (result.error) {
      setLoading(false);
      setError(typeof result.error === "string" ? result.error : "Registration failed");
      return;
    }
    if (result.checkoutUrl) {
      window.location.href = result.checkoutUrl;
      return;
    }
    setLoading(false);
    if (result.message) setMessage(result.message);
    if (result.confirmed) {
      router.push(`/tournaments/${slug}/register/success?registration=${result.registrationId}`);
    }
  }

  if (!divisions.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Divisions haven&apos;t been set up yet — registration will open once they are.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {message && (
        <Alert>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      <fieldset>
        <legend className="eyebrow mb-3">1 · Choose a division</legend>
        <div className="grid gap-2" role="radiogroup">
          {divisions.map((d) => {
            const active = d.id === divisionId;
            return (
              <button
                key={d.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setDivisionId(d.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all",
                  active
                    ? "border-bone bg-bone/[0.06]"
                    : "border-line hover:border-bone/30 hover:bg-ink/30"
                )}
              >
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                    active ? "border-bone bg-bone text-ink" : "border-bone/30"
                  )}
                >
                  {active && <Check className="size-3" strokeWidth={3} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-bone">{d.name}</span>
                  <span className="block text-xs text-muted-foreground capitalize">{d.format}</span>
                </span>
                <span className="font-mono text-sm text-bone/80">
                  {formatPhp(d.entry_fee_cents ?? defaultFeeCents, currency)}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {selected?.format === "doubles" && (
        <div className="space-y-2 animate-in fade-in-0 slide-in-from-top-1">
          <Label htmlFor="partner" className="eyebrow">
            2 · Partner&apos;s email <span className="normal-case tracking-normal">(optional)</span>
          </Label>
          <Input
            id="partner"
            type="email"
            value={partnerEmail}
            onChange={(e) => setPartnerEmail(e.target.value)}
            placeholder="partner@email.com"
          />
          <p className="text-xs text-muted-foreground">
            We&apos;ll email them an invite to join your team. You can add them later too.
          </p>
        </div>
      )}

      <div className="rounded-xl border border-line bg-ink/40 p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Total due</span>
          <span className="display text-3xl text-bone">{formatPhp(fee, currency)}</span>
        </div>
        <Button
          size="lg"
          className="mt-4 w-full"
          onClick={handleRegister}
          disabled={loading || !divisionId}
        >
          {loading ? (
            <>
              <Loader2 className="animate-spin" />
              Preparing checkout…
            </>
          ) : fee > 0 ? (
            "Continue to payment"
          ) : (
            "Confirm registration"
          )}
        </Button>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="size-3" aria-hidden />
          Secure checkout by PayMongo
        </p>
      </div>
    </div>
  );
}
