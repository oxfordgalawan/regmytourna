"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { createTournamentAction } from "@/app/actions/tournaments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

const publishOptions = [
  { value: "draft", label: "Save as draft", hint: "Only you can see it" },
  { value: "published", label: "Announce", hint: "Listed, entries not open yet" },
  { value: "registration_open", label: "Open registration", hint: "Listed and taking entries" },
];

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function FormSection({
  step,
  title,
  description,
  children,
}: {
  step: number;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-6 border-t border-line py-10 first:border-t-0 first:pt-0 lg:grid-cols-[15rem_1fr] lg:gap-12">
      <div>
        <p className="font-mono text-xs text-brass">0{step}</p>
        <h2 className="mt-2 text-lg font-semibold text-bone">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({
  id,
  label,
  hint,
  className,
  children,
}: {
  id?: string;
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Toggle({
  name,
  label,
  hint,
  defaultChecked,
}: {
  name: string;
  label: string;
  hint: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-line p-4 transition-colors hover:border-bone/25 sm:col-span-2">
      <span>
        <span className="block text-sm font-medium text-bone">{label}</span>
        <span className="block text-sm text-muted-foreground">{hint}</span>
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input type="checkbox" name={name} defaultChecked={defaultChecked} className="peer sr-only" />
        <span className="h-6 w-11 rounded-full bg-surface-2 ring-1 ring-line transition-colors peer-checked:bg-bone peer-focus-visible:ring-2 peer-focus-visible:ring-brass" />
        <span className="absolute top-1 left-1 size-4 rounded-full bg-bone/70 transition-all peer-checked:translate-x-5 peer-checked:bg-ink" />
      </span>
    </label>
  );
}

export function TournamentForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("draft");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);

  const effectiveSlug = slugEdited ? slug : slugify(name);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const pesos = Number(fd.get("entryFeePesos") || 0);
    fd.set("entryFeeCents", String(Math.round(pesos * 100)));
    fd.delete("entryFeePesos");
    const result = await createTournamentAction(fd);
    setLoading(false);
    if (result.error) {
      setError(
        typeof result.error === "string"
          ? result.error
          : Object.entries(result.error)
              .map(([field, msgs]) => `${field}: ${(msgs as string[] | undefined)?.join(", ")}`)
              .join(" · ") || "Please check the form and try again."
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (result.id) router.push(`/organizer/tournaments/${result.id}`);
  }

  return (
    <form onSubmit={onSubmit} className="max-w-5xl">
      {error && (
        <Alert variant="destructive" className="mb-8">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <FormSection step={1} title="The basics" description="What players see first.">
        <Field id="name" label="Tournament name" className="sm:col-span-2">
          <Input
            id="name"
            name="name"
            required
            minLength={3}
            placeholder="Manila Open 2026"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field
          id="slug"
          label="Page address"
          hint={`regmytourna.com/tournaments/${effectiveSlug || "your-event"}`}
        >
          <Input
            id="slug"
            name="slug"
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            placeholder="manila-open-2026"
            value={effectiveSlug}
            onChange={(e) => {
              setSlugEdited(true);
              setSlug(slugify(e.target.value));
            }}
          />
        </Field>
        <Field id="sport" label="Sport">
          <Input id="sport" name="sport" defaultValue="pickleball" />
        </Field>
        <Field id="description" label="Short description" className="sm:col-span-2">
          <Textarea
            id="description"
            name="description"
            rows={3}
            placeholder="Two days of DUPR-rated doubles at the city's best indoor courts."
          />
        </Field>
      </FormSection>

      <FormSection step={2} title="When" description="Event days and the registration window.">
        <Field id="startDate" label="First day">
          <Input id="startDate" name="startDate" type="date" />
        </Field>
        <Field id="endDate" label="Last day" hint="Leave empty for a one-day event.">
          <Input id="endDate" name="endDate" type="date" />
        </Field>
        <Field id="registrationOpensAt" label="Entries open">
          <Input id="registrationOpensAt" name="registrationOpensAt" type="datetime-local" />
        </Field>
        <Field id="registrationClosesAt" label="Entries close">
          <Input id="registrationClosesAt" name="registrationClosesAt" type="datetime-local" />
        </Field>
      </FormSection>

      <FormSection step={3} title="Where" description="Help players find the venue.">
        <Field id="venueName" label="Venue">
          <Input id="venueName" name="venueName" placeholder="Rizal Memorial Courts" />
        </Field>
        <Field id="city" label="City">
          <Input id="city" name="city" placeholder="Manila" />
        </Field>
        <Field id="venueAddress" label="Full address" className="sm:col-span-2">
          <Input id="venueAddress" name="venueAddress" />
        </Field>
      </FormSection>

      <FormSection step={4} title="Entries" description="Fees, limits and the rules of play.">
        <Field id="entryFeePesos" label="Default entry fee" hint="Per entry. Divisions can override this.">
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted-foreground">
              ₱
            </span>
            <Input
              id="entryFeePesos"
              name="entryFeePesos"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              defaultValue={0}
              className="pl-8 font-mono"
            />
          </div>
        </Field>
        <Field id="maxCapacity" label="Max entries" hint="Optional. Leave empty for no cap.">
          <Input id="maxCapacity" name="maxCapacity" type="number" min={1} inputMode="numeric" />
        </Field>
        <Field id="rules" label="Rules & eligibility" className="sm:col-span-2">
          <Textarea
            id="rules"
            name="rules"
            rows={4}
            placeholder="Rally scoring to 11, win by 2. Players must be DUPR-rated within the division range."
          />
        </Field>
        <Field id="coverImageUrl" label="Cover image URL" className="sm:col-span-2">
          <Input id="coverImageUrl" name="coverImageUrl" type="url" placeholder="https://" />
        </Field>
        <Toggle
          name="waitlistEnabled"
          label="Waitlist when full"
          hint="Extra entries queue up instead of being turned away."
        />
      </FormSection>

      <FormSection step={5} title="Publish" description="Choose who can see it.">
        <div className="grid gap-2 sm:col-span-2 sm:grid-cols-3" role="radiogroup" aria-label="Publication status">
          {publishOptions.map((opt) => {
            const active = status === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setStatus(opt.value)}
                className={cn(
                  "relative rounded-xl border p-4 text-left transition-all",
                  active ? "border-bone bg-bone text-ink" : "border-line text-bone hover:border-bone/40"
                )}
              >
                {active && <Check className="absolute top-4 right-4 size-4" strokeWidth={3} />}
                <span className="block text-sm font-semibold">{opt.label}</span>
                <span className={cn("mt-1 block text-xs", active ? "text-ink/65" : "text-muted-foreground")}>
                  {opt.hint}
                </span>
              </button>
            );
          })}
        </div>
        <Toggle
          name="isPublic"
          label="Show in public listings"
          hint="Turn off for invite-only events — they stay reachable by direct link."
          defaultChecked
        />
      </FormSection>

      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="currency" value="PHP" />

      <div className="sticky bottom-0 z-20 -mx-4 mt-4 flex items-center justify-end gap-3 border-t border-line bg-ink/90 px-4 py-4 backdrop-blur-md sm:mx-0 sm:rounded-2xl sm:border">
        <p className="mr-auto hidden text-sm text-muted-foreground sm:block">
          {publishOptions.find((o) => o.value === status)?.hint}
        </p>
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" size="lg" disabled={loading}>
          {loading && <Loader2 className="animate-spin" />}
          {loading ? "Creating…" : "Create tournament"}
        </Button>
      </div>
    </form>
  );
}
