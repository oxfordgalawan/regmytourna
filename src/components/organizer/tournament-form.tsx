"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, ClipboardList, Loader2, Upload } from "lucide-react";
import { createTournamentAction } from "@/app/actions/tournaments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CategoryBuilder } from "@/components/organizer/category-builder";
import { FormSection } from "@/components/organizer/form-section";
import { SPORTS } from "@/lib/categories";
import { CoverImageUpload } from "@/components/images/cover-image-upload";
import { registrationDeadline, validateSchedule } from "@/lib/validations/schedule";
import { PlaceSearchCombobox, type PlaceSelection } from "@/components/places/place-search-combobox";
import { cn } from "@/lib/utils";
import { RegistrationDateTimeInput } from "@/components/organizer/registration-datetime-input";

const publishOptions = [
  { value: "draft", label: "Save as draft", hint: "Only you can see it" },
  { value: "published", label: "Announce", hint: "Listed, entries not open yet" },
  { value: "registration_open", label: "Open registration", hint: "Listed and taking entries" },
];

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** While typing: same rules as `slugify` but keeps a trailing hyphen so "manila-" can be typed. */
function slugDraft(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, 60);
}

function Field({
  id,
  label,
  hint,
  error,
  className,
  children,
}: {
  id?: string;
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p className="text-xs text-[#e58a72] animate-in fade-in-0" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
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
  const [mode, setMode] = useState<"open" | "bracket_only">("open");
  const bracketOnly = mode === "bracket_only";
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("draft");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [street, setStreet] = useState("");
  const [schedule, setSchedule] = useState({
    startDate: "",
    endDate: "",
    registrationOpensAt: "",
    registrationClosesAt: "",
  });
  const scheduleErrors = validateSchedule(schedule);
  const setDate = (key: keyof typeof schedule) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setSchedule((s) => ({ ...s, [key]: e.target.value }));
  const setRegistrationDateTime =
    (key: "registrationOpensAt" | "registrationClosesAt") => (value: string) =>
      setSchedule((s) => ({ ...s, [key]: value }));
  const deadline = schedule.startDate ? registrationDeadline(schedule.startDate) : undefined;
  const [place, setPlace] = useState<PlaceSelection | null>(null);

  const effectiveSlug = slugEdited ? slug : slugify(name);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (Object.keys(scheduleErrors).length) {
      setError("Please fix the dates in step 2.");
      document.getElementById("startDate")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
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
    if (result.id) {
      // bracket-only: straight to the Players tab to import the list
      router.push(`/organizer/tournaments/${result.id}${bracketOnly ? "/registrations" : ""}`);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-5xl">
      {error && (
        <Alert variant="destructive" className="mb-8">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <section className="mb-10 space-y-3">
        <h2 className="eyebrow">How will players get in?</h2>
        <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="How players get in">
          {(
            [
              ["open", ClipboardList, "Players register online", "A public page where players sign up and pay. You approve, collect and run the draw."],
              ["bracket_only", Upload, "I already have my player list", "Bracket & scoring only. Import names from Excel — no registration page, no payments."],
            ] as const
          ).map(([value, Icon, title, body]) => {
            const active = mode === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => {
                  setMode(value);
                  if (value === "bracket_only" && status === "registration_open") setStatus("published");
                }}
                className={cn(
                  "relative flex gap-4 rounded-2xl border p-5 text-left transition-all",
                  active ? "border-bone bg-bone/[0.06]" : "border-line hover:border-bone/30"
                )}
              >
                <span
                  className={cn(
                    "flex size-11 shrink-0 items-center justify-center rounded-xl",
                    active ? "bg-bone text-ink" : "bg-umber/40 text-brass"
                  )}
                >
                  <Icon className="size-5" />
                </span>
                <span>
                  <span className="block font-semibold text-bone">{title}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">{body}</span>
                </span>
                {active && <Check className="absolute top-4 right-4 size-4 text-bone" strokeWidth={3} />}
              </button>
            );
          })}
        </div>
        <input type="hidden" name="registrationMode" value={mode} />
      </section>

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
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="slug">Page address</Label>
            {slugEdited ? (
              <button
                type="button"
                onClick={() => {
                  setSlugEdited(false);
                  setSlug("");
                }}
                className="text-xs text-muted-foreground underline-offset-4 hover:text-bone hover:underline"
              >
                Match name
              </button>
            ) : (
              <span className="rounded-full bg-umber/40 px-2 py-0.5 font-mono text-[0.6rem] tracking-wider text-brass uppercase">
                Auto
              </span>
            )}
          </div>
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 font-mono text-sm text-muted-foreground">
              /tournaments/
            </span>
            <Input
              id="slug"
              name="slug"
              required
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              placeholder="fills in from the name"
              value={effectiveSlug}
              className="pl-[7.5rem] font-mono"
              onChange={(e) => {
                const typed = slugDraft(e.target.value);
                // clearing the field goes back to following the name
                setSlugEdited(typed !== "");
                setSlug(typed);
              }}
              onBlur={() => slugEdited && setSlug((s) => slugify(s))}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {slugEdited
              ? "Custom address. Letters, numbers and hyphens."
              : "Created from the tournament name — type here to change it."}
          </p>
        </div>
        <Field id="sport" label="Sport" hint="More sports are coming soon.">
          <div className="relative">
            <select
              id="sport"
              name="sport"
              defaultValue="pickleball"
              className="h-11 w-full appearance-none rounded-lg border border-input bg-ink/40 pr-10 pl-3.5 text-base text-bone outline-none hover:border-bone/30 focus-visible:border-brass md:text-sm"
            >
              {SPORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          </div>
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

      <FormSection
        step={2}
        title="When"
        description={bracketOnly ? "The event days." : "Event days and the registration window."}
      >
        <Field id="startDate" label="First day">
          <Input id="startDate" name="startDate" type="date" value={schedule.startDate} onChange={setDate("startDate")} />
        </Field>
        <Field id="endDate" label="Last day" hint="Leave empty for a one-day event." error={scheduleErrors.endDate}>
          <Input
            id="endDate"
            name="endDate"
            type="date"
            min={schedule.startDate || undefined}
            value={schedule.endDate}
            onChange={setDate("endDate")}
            aria-invalid={Boolean(scheduleErrors.endDate)}
          />
        </Field>
        {!bracketOnly && (<>
        <Field
          id="registrationOpensAt"
          label="Registration period opens"
          hint={
            schedule.startDate
              ? "Time defaults to 12:00 AM unless you change hr and min."
              : "Pick the first day above to limit these dates. Time defaults to 12:00 AM."
          }
          error={scheduleErrors.registrationOpensAt}
        >
          <RegistrationDateTimeInput
            id="registrationOpensAt"
            name="registrationOpensAt"
            max={deadline}
            value={schedule.registrationOpensAt}
            onChange={setRegistrationDateTime("registrationOpensAt")}
            aria-invalid={Boolean(scheduleErrors.registrationOpensAt)}
          />
        </Field>
        <Field
          id="registrationClosesAt"
          label="Registration period closes"
          hint={
            schedule.startDate
              ? "On or before the first day. Time defaults to 12:00 AM."
              : "Time defaults to 12:00 AM unless you change hr and min."
          }
          error={scheduleErrors.registrationClosesAt}
        >
          <RegistrationDateTimeInput
            id="registrationClosesAt"
            name="registrationClosesAt"
            min={schedule.registrationOpensAt || undefined}
            max={deadline}
            value={schedule.registrationClosesAt}
            onChange={setRegistrationDateTime("registrationClosesAt")}
            aria-invalid={Boolean(scheduleErrors.registrationClosesAt)}
          />
        </Field>
        </>)}
      </FormSection>

      <FormSection step={3} title="Where" description="Help players find the venue.">
        <Field id="venueName" label="Venue name" className="sm:col-span-2">
          <Input id="venueName" name="venueName" placeholder="e.g. Riverside Sports Complex" />
        </Field>
        <Field
          id="venueStreet"
          label="Street, purok or landmark"
          hint="Optional — whatever helps players find the gate."
          className="sm:col-span-2"
        >
          <Input
            id="venueStreet"
            value={street}
            onChange={(e) => setStreet(e.target.value)}
            placeholder="e.g. 123 Rizal St., Purok 4, beside the covered court"
          />
        </Field>
        <div className="sm:col-span-2">
          <PlaceSearchCombobox
            id="venuePlace"
            value={place}
            onChange={setPlace}
            label="Barangay & city/municipality"
            hint="Start typing, then pick from the list."
            placeholder="e.g. Brgy Holy Spirit, Quezon City"
          />
        </div>
        {/* what the server stores: city/region for listings, plus one readable address */}
        <input type="hidden" name="city" value={place?.cityMunicipalityName ?? ""} />
        <input type="hidden" name="region" value={place?.regionName ?? ""} />
        <input
          type="hidden"
          name="venueAddress"
          value={[street.trim(), place?.label].filter(Boolean).join(", ")}
        />
      </FormSection>

      <CategoryBuilder bracketOnly={bracketOnly} />

      <FormSection step={6} title="Rules & extras" description="The fine print and finishing touches.">
        <Field id="rules" label="Rules & eligibility" className="sm:col-span-2">
          <Textarea
            id="rules"
            name="rules"
            rows={4}
            placeholder="Rally scoring to 11, win by 2. Players must be DUPR-rated within the category range."
          />
        </Field>
        <Field label="Cover photo" hint="Optional. Shown at the top of your tournament page." className="sm:col-span-2">
          <CoverImageUpload />
        </Field>
        {!bracketOnly && (
          <Toggle
            name="waitlistEnabled"
            label="Waitlist when full"
            hint="Extra entries queue up instead of being turned away."
          />
        )}
      </FormSection>

      <FormSection step={7} title="Publish" description="Choose who can see it.">
        <div className="grid gap-2 sm:col-span-2 sm:grid-cols-3" role="radiogroup" aria-label="Publication status">
          {publishOptions.filter((o) => !bracketOnly || o.value !== "registration_open").map((opt) => {
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
                <span className="block text-sm font-semibold">{bracketOnly && opt.value === "published" ? "Publish" : opt.label}</span>
                <span className={cn("mt-1 block text-xs", active ? "text-ink/65" : "text-muted-foreground")}>
                  {bracketOnly && opt.value === "published" ? "Public page with categories and live bracket" : opt.hint}
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

      <div className="sticky bottom-[var(--app-bottom-nav,0px)] z-20 -mx-4 mt-4 flex items-center justify-end gap-3 border-t border-line bg-ink/90 px-4 py-4 backdrop-blur-md sm:mx-0 sm:rounded-2xl sm:border">
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
