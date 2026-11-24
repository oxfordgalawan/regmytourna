import type { Metadata } from "next";
import { formatDateRange, formatDateTime, formatPhp } from "@/lib/format";
import { modeOf } from "@/lib/tournaments/mode";
import { isRegistrationWindowOpen, registrationWindowOpensAt } from "@/lib/tournaments/registration-window";

export const DEFAULT_OG_IMAGE_PATH = "/og-tournament-default.jpg";
export const DEFAULT_OG_WIDTH = 1200;
export const DEFAULT_OG_HEIGHT = 630;

type DivisionFee = { entry_fee_cents: number | null };

export type TournamentShareInput = {
  name: string;
  slug: string;
  description?: string | null;
  cover_image_url?: string | null;
  currency?: string;
  entry_fee_cents: number;
  start_date: string | null;
  end_date: string | null;
  venue_name?: string | null;
  city?: string | null;
  venue_address?: string | null;
  status: string;
  registration_opens_at?: string | null;
  registration_closes_at?: string | null;
  tournament_divisions?: DivisionFee[] | null;
};

function feeLabel(t: TournamentShareInput): string | null {
  const bracketOnly = modeOf(t as Record<string, unknown>) === "bracket_only";
  if (bracketOnly) return null;
  const divisions = t.tournament_divisions ?? [];
  const fees = divisions.length
    ? divisions.map((d) => d.entry_fee_cents ?? t.entry_fee_cents)
    : [t.entry_fee_cents];
  const minFee = Math.min(...fees);
  const maxFee = Math.max(...fees);
  if (minFee <= 0 && maxFee <= 0) return "Free entry";
  const currency = t.currency ?? "PHP";
  return minFee === maxFee
    ? `${formatPhp(minFee, currency)} per entry`
    : `${formatPhp(minFee, currency)} – ${formatPhp(maxFee, currency)} per entry`;
}

function registrationLead(t: TournamentShareInput): string {
  const bracketOnly = modeOf(t as Record<string, unknown>) === "bracket_only";
  if (bracketOnly) return "Entries managed by the organizer on RegMyTourna.";
  const schedule = {
    status: t.status,
    registration_opens_at: t.registration_opens_at,
    registration_closes_at: t.registration_closes_at,
  };
  if (isRegistrationWindowOpen(schedule)) return "Registration is open on RegMyTourna.";
  const opensLater = registrationWindowOpensAt(schedule);
  if (opensLater) {
    const when = formatDateTime(opensLater.toISOString());
    return when
      ? `Registration opens ${when} (Philippine time) on RegMyTourna.`
      : "Registration has not opened yet on RegMyTourna — check back closer to the date.";
  }
  if (t.status === "registration_closed" || t.status === "in_progress" || t.status === "completed") {
    return "Registration is closed for this event on RegMyTourna.";
  }
  return "Registration has not opened yet on RegMyTourna — check back closer to the date.";
}

function venueLine(t: TournamentShareInput): string | null {
  const name = t.venue_name?.trim();
  const place = [name, t.city?.trim()].filter(Boolean).join(", ");
  return place || null;
}

export function buildTournamentShareDescription(t: TournamentShareInput): string {
  const parts: string[] = [registrationLead(t)];
  const dates = formatDateRange(t.start_date, t.end_date);
  if (dates) parts.push(`Tournament ${dates}.`);
  const venue = venueLine(t);
  if (venue) parts.push(venue + ".");
  const closes = formatDateTime(t.registration_closes_at ?? null);
  if (closes && modeOf(t as Record<string, unknown>) !== "bracket_only") {
    parts.push(`Entries close ${closes}.`);
  }
  const fees = feeLabel(t);
  if (fees) parts.push(fees + " (paid online).");
  parts.push("Register on RegMyTourna.");
  const text = parts.join(" ");
  if (text.length <= 280) return text;
  const short = [registrationLead(t), dates ? `Event ${dates}.` : "", venue ?? "", "Register on RegMyTourna."]
    .filter(Boolean)
    .join(" ");
  return short.length <= 300 ? short : short.slice(0, 297) + "…";
}

export function tournamentShareImage(t: TournamentShareInput, metadataBase: URL) {
  const cover = t.cover_image_url?.trim();
  if (cover && (cover.startsWith("https://") || cover.startsWith("http://"))) {
    return {
      url: cover,
      width: undefined as number | undefined,
      height: undefined as number | undefined,
      alt: `${t.name} — tournament poster`,
    };
  }
  return {
    url: new URL(DEFAULT_OG_IMAGE_PATH, metadataBase).toString(),
    width: DEFAULT_OG_WIDTH,
    height: DEFAULT_OG_HEIGHT,
    alt: "RegMyTourna tournament registration",
  };
}

export function buildTournamentPageMetadata(t: TournamentShareInput, metadataBase: URL): Metadata {
  const description = buildTournamentShareDescription(t);
  const canonicalPath = `/tournaments/${t.slug}`;
  const url = new URL(canonicalPath, metadataBase).toString();
  const image = tournamentShareImage(t, metadataBase);
  const title = t.name;

  return {
    title,
    description,
    alternates: { canonical: canonicalPath },
    openGraph: {
      title,
      description,
      url,
      type: "website",
      siteName: "RegMyTourna",
      images: [
        {
          url: image.url,
          ...(image.width && image.height ? { width: image.width, height: image.height } : {}),
          alt: image.alt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image.url],
    },
  };
}