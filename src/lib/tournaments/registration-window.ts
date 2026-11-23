import type { TournamentStatus } from "@/types/database";

/** Registration open/close datetimes are entered as Philippine wall clock (no offset in forms). */
const PH_OFFSET = "+08:00";

export function parseRegistrationInstant(value: string | null | undefined): Date | null {
  if (!value?.trim()) return null;
  const v = value.trim();
  if (/[zZ]$/.test(v) || /[+-]\d{2}:?\d{2}$/.test(v)) {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const m = v.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(?::(\d{2}))?/);
  if (m) {
    const d = new Date(`${m[1]}T${m[2]}:${m[3] ?? "00"}${PH_OFFSET}`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

const REGISTRATION_ACTIVE_STATUSES = new Set<TournamentStatus>(["published", "registration_open"]);

export type RegistrationSchedule = {
  status: TournamentStatus | string;
  registration_opens_at?: string | null;
  registration_closes_at?: string | null;
};

/** Whether players may submit entries right now (public page + server actions). */
export function isRegistrationWindowOpen(
  tournament: RegistrationSchedule,
  now: Date = new Date()
): boolean {
  if (!REGISTRATION_ACTIVE_STATUSES.has(tournament.status as TournamentStatus)) return false;

  const opens = parseRegistrationInstant(tournament.registration_opens_at);
  if (opens && now < opens) return false;

  // Announced only: need a scheduled open time that has passed (or switch status to Open registration).
  if (tournament.status === "published" && !tournament.registration_opens_at) return false;

  const closes = parseRegistrationInstant(tournament.registration_closes_at);
  if (closes && now >= closes) return false;

  return true;
}

export function registrationWindowOpensAt(tournament: RegistrationSchedule, now = new Date()) {
  const opens = parseRegistrationInstant(tournament.registration_opens_at);
  if (!opens || now >= opens) return null;
  return opens;
}

/** Persist form `YYYY-MM-DDTHH:mm` as a timestamptz-friendly ISO string (Philippine wall time). */
export function registrationInstantForDb(value: string | undefined | null): string | null {
  const d = parseRegistrationInstant(value ?? null);
  return d ? d.toISOString() : null;
}