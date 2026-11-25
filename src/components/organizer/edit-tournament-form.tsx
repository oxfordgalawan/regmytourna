"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { updateTournamentAction } from "@/app/actions/tournaments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormSection } from "@/components/organizer/form-section";
import { CoverImageUpload } from "@/components/images/cover-image-upload";
import { registrationDeadline, validateSchedule } from "@/lib/validations/schedule";
import { PlaceSearchCombobox, type PlaceSelection } from "@/components/places/place-search-combobox";
import { RegistrationDateTimeInput } from "@/components/organizer/registration-datetime-input";
import { showError } from "@/lib/ui/error-dialog";
import { toast } from "@/lib/ui/app-toast";
import { cn } from "@/lib/utils";
import { parseRegistrationInstant } from "@/lib/tournaments/registration-window";
export type EditableTournament = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  registration_opens_at: string | null;
  registration_closes_at: string | null;
  venue_name: string | null;
  venue_address: string | null;
  city: string | null;
  region: string | null;
  rules: string | null;
  cover_image_url: string | null;
  is_public: boolean;
  waitlist_enabled: boolean;
  waitlist_max?: number | null;
  allow_walk_in_payment?: boolean | null;
};

/** Stored timestamps back to the `YYYY-MM-DDTHH:mm` value entered as Philippine time. */
function toFormDateTime(value: string | null) {
  if (!value) return "";
  const d = parseRegistrationInstant(value);
  if (!d) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  const hour = get("hour");
  const minute = get("minute");
  return `${get("year")}-${get("month")}-${get("day")}T${hour === "24" ? "00" : hour}:${minute}`;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
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
        <p className="text-xs text-[#e58a72]" role="alert">
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
  onCheckedChange,
}: {
  name: string;
  label: string;
  hint: string;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-line p-4 transition-colors hover:border-bone/25 sm:col-span-2">
      <span>
        <span className="block text-sm font-medium text-bone">{label}</span>
        <span className="block text-sm text-muted-foreground">{hint}</span>
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input
          type="checkbox"
          name={name}
          defaultChecked={defaultChecked}
          className="peer sr-only"
          onChange={(e) => onCheckedChange?.(e.target.checked)}
        />
        <span className="h-6 w-11 rounded-full bg-surface-2 ring-1 ring-line transition-colors peer-checked:bg-bone peer-focus-visible:ring-2 peer-focus-visible:ring-brass" />
        <span className="absolute top-1 left-1 size-4 rounded-full bg-bone/70 transition-all peer-checked:translate-x-5 peer-checked:bg-ink" />
      </span>
    </label>
  );
}

export function EditTournamentForm({
  tournament: t,
  bracketOnly,
}: {
  tournament: EditableTournament;
  bracketOnly: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [slug, setSlug] = useState(t.slug);
  const [schedule, setSchedule] = useState({
    startDate: t.start_date ?? "",
    endDate: t.end_date ?? "",
    registrationOpensAt: toFormDateTime(t.registration_opens_at),
    registrationClosesAt: toFormDateTime(t.registration_closes_at),
  });
  const [waitlistOn, setWaitlistOn] = useState(t.waitlist_enabled);
  const [place, setPlace] = useState<PlaceSelection | null>(
    t.city
      ? {
          psgcCode: "current",
          label: [t.city, t.region].filter(Boolean).join(", "),
          cityMunicipalityName: t.city,
          regionName: t.region ?? undefined,
        }
      : null
  );

  const scheduleErrors = validateSchedule(schedule);
  const deadline = schedule.startDate ? registrationDeadline(schedule.startDate) : undefined;
  const setDate = (key: keyof typeof schedule) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setSchedule((s) => ({ ...s, [key]: e.target.value }));
  const setDateTime = (key: "registrationOpensAt" | "registrationClosesAt") => (value: string) =>
    setSchedule((s) => ({ ...s, [key]: value }));

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (Object.keys(scheduleErrors).length) {
      showError("Please fix the dates first.", { title: "Couldn't save changes" });
      return;
    }
    setSaving(true);
    const result = await updateTournamentAction(t.id, new FormData(e.currentTarget));
    setSaving(false);
    if (result.error) {
      showError(result.error, { title: "Couldn't save changes" });
      return;
    }
    toast.success("Event updated");
    router.push(`/organizer/tournaments/${t.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="max-w-5xl">
      <FormSection step={1} title="The basics" description="What players see first.">
        <Field id="name" label="Tournament name" className="sm:col-span-2">
          <Input id="name" name="name" required minLength={3} defaultValue={t.name} />
        </Field>
        <Field
          id="slug"
          label="Page address"
          hint={slug !== t.slug ? "Old links to this event will stop working." : "Letters, numbers and hyphens."}
          className="sm:col-span-2"
        >
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 font-mono text-sm text-muted-foreground">
              /tournaments/
            </span>
            <Input
              id="slug"
              name="slug"
              required
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              value={slug}
              className="pl-[7.5rem] font-mono"
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
              onBlur={() => setSlug((s) => slugify(s) || t.slug)}
            />
          </div>
        </Field>
        <Field id="description" label="Short description" className="sm:col-span-2">
          <Textarea id="description" name="description" rows={3} defaultValue={t.description ?? ""} />
        </Field>
      </FormSection>

      <FormSection step={2} title="When" description={bracketOnly ? "The event days." : "Event days and the registration window."}>
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
        {!bracketOnly && (
          <>
            <Field id="registrationOpensAt" label="Registration period opens" error={scheduleErrors.registrationOpensAt}>
              <RegistrationDateTimeInput
                id="registrationOpensAt"
                name="registrationOpensAt"
                max={deadline}
                value={schedule.registrationOpensAt}
                onChange={setDateTime("registrationOpensAt")}
                aria-invalid={Boolean(scheduleErrors.registrationOpensAt)}
              />
            </Field>
            <Field
              id="registrationClosesAt"
              label="Registration period closes"
              hint="On or before the first day."
              error={scheduleErrors.registrationClosesAt}
            >
              <RegistrationDateTimeInput
                id="registrationClosesAt"
                name="registrationClosesAt"
                min={schedule.registrationOpensAt || undefined}
                max={deadline}
                value={schedule.registrationClosesAt}
                onChange={setDateTime("registrationClosesAt")}
                aria-invalid={Boolean(scheduleErrors.registrationClosesAt)}
              />
            </Field>
          </>
        )}
      </FormSection>

      <FormSection step={3} title="Where" description="Help players find the venue.">
        <Field id="venueName" label="Venue name" className="sm:col-span-2">
          <Input id="venueName" name="venueName" defaultValue={t.venue_name ?? ""} />
        </Field>
        <Field id="venueAddress" label="Full address" hint="Shown on the event page." className="sm:col-span-2">
          <Input id="venueAddress" name="venueAddress" defaultValue={t.venue_address ?? ""} />
        </Field>
        <div className="sm:col-span-2">
          <PlaceSearchCombobox
            id="venuePlace"
            value={place}
            onChange={setPlace}
            label="City/municipality"
            hint="Used for the city filter. Start typing, then pick from the list."
            placeholder="e.g. Quezon City"
          />
        </div>
        <input type="hidden" name="city" value={place?.cityMunicipalityName ?? ""} />
        <input type="hidden" name="region" value={place?.regionName ?? ""} />
      </FormSection>

      <FormSection step={4} title="Rules & extras" description="The fine print and finishing touches.">
        <Field id="rules" label="Rules & eligibility" className="sm:col-span-2">
          <Textarea id="rules" name="rules" rows={4} defaultValue={t.rules ?? ""} />
        </Field>
        <Field
          label="Cover photo"
          hint="Shown at the top of your tournament page and when the event link is shared (e.g. Facebook). Use a wide poster around 1200×630 px for best results."
          className="sm:col-span-2"
        >
          <CoverImageUpload defaultUrl={t.cover_image_url} />
        </Field>
        {!bracketOnly && (
          <>
            <Toggle
              name="waitlistEnabled"
              label="Waitlist when full"
              hint="Extra entries queue up instead of being turned away."
              defaultChecked={t.waitlist_enabled}
              onCheckedChange={setWaitlistOn}
            />
            {waitlistOn && (
              <Field
                id="waitlistMax"
                label="Waitlist size per category"
                hint="Max entries on the waitlist in each category. Leave blank for no limit."
                className="sm:col-span-2"
              >
                <Input
                  id="waitlistMax"
                  name="waitlistMax"
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  placeholder="e.g. 10"
                  defaultValue={t.waitlist_max ?? ""}
                />
              </Field>
            )}
            <Toggle
              name="allowWalkInPayment"
              label="Allow walk-in payment"
              hint="Players can reserve online and pay at the venue."
              defaultChecked={Boolean(t.allow_walk_in_payment)}
            />
          </>
        )}
        <Toggle
          name="isPublic"
          label="Show in public listings"
          hint="Turn off for invite-only events — they stay reachable by direct link."
          defaultChecked={t.is_public}
        />
      </FormSection>

      <div className="sticky bottom-[var(--app-bottom-nav,0px)] z-20 -mx-4 mt-4 flex items-center justify-end gap-3 border-t border-line bg-ink/90 px-4 py-4 backdrop-blur-md sm:mx-0 sm:rounded-2xl sm:border">
        <p className="mr-auto hidden text-sm text-muted-foreground sm:block">
          Categories, status and brackets are managed in their own tabs.
        </p>
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Back
        </Button>
        <Button type="submit" size="lg" disabled={saving}>
          {saving && <Loader2 className="animate-spin" />}
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
