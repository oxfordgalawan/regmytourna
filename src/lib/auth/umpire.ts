import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOptionalUser } from "@/lib/auth/require-user";
import { isOrganizerForTournament } from "@/lib/auth/require-organizer";

/**
 * Umpire access: one shared PIN per tournament, no accounts.
 *
 * - The PIN is stored as `salt:scrypt-hash`.
 * - A correct PIN sets an httpOnly cookie `<tournamentId>.<accessVersion>.<expiry>.<hmac>`.
 * - Bumping `tournament_umpire_access.access_version` invalidates every issued cookie.
 * - That table is service-role only (RLS, no policies): hashes never reach clients.
 */

const SESSION_HOURS = 12;
export const MAX_PIN_ATTEMPTS = 5;
export const LOCKOUT_MINUTES = 10;

const cookieName = (tournamentId: string) => `rmt_umpire_${tournamentId}`;

function secret() {
  const explicit = process.env.UMPIRE_SESSION_SECRET;
  if (explicit) return explicit;
  // fall back to a key derived from another server-only secret so local setups work
  const base = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base) throw new Error("Set UMPIRE_SESSION_SECRET to enable umpire access");
  return createHash("sha256").update(`umpire:${base}`).digest("hex");
}

export function isValidPin(pin: string) {
  return /^\d{4,6}$/.test(pin);
}

export function hashPin(pin: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pin, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPin(pin: string, stored: string | null | undefined) {
  if (!stored) return false;
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(pin, salt, 32);
  const expected = Buffer.from(hash, "hex");
  return expected.length === candidate.length && timingSafeEqual(candidate, expected);
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

export async function issueUmpireSession(tournamentId: string, accessVersion: number) {
  const expires = Date.now() + SESSION_HOURS * 3_600_000;
  const payload = `${tournamentId}.${accessVersion}.${expires}`;
  (await cookies()).set(cookieName(tournamentId), `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
}

export async function clearUmpireSession(tournamentId: string) {
  (await cookies()).delete(cookieName(tournamentId));
}

/** True when this browser holds a valid, unrevoked umpire session for the tournament. */
export async function hasUmpireSession(tournamentId: string) {
  const raw = (await cookies()).get(cookieName(tournamentId))?.value;
  if (!raw) return false;
  const parts = raw.split(".");
  if (parts.length !== 4) return false;
  const [tid, version, expires, mac] = parts;
  const payload = `${tid}.${version}.${expires}`;
  const expected = Buffer.from(sign(payload), "hex");
  const given = Buffer.from(mac, "hex");
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return false;
  if (tid !== tournamentId || Number(expires) < Date.now()) return false;

  const access = await getUmpireAccess(tournamentId);
  return Boolean(access?.pin_hash) && access?.access_version === Number(version);
}

export async function getUmpireAccess(tournamentId: string) {
  const { data } = await createAdminClient()
    .from("tournament_umpire_access")
    .select("pin_hash, access_version")
    .eq("tournament_id", tournamentId)
    .maybeSingle();
  return data as { pin_hash: string | null; access_version: number } | null;
}

export type ScoringActor = { operatorId: string | null; operatorLabel: string };

/** Organizers (logged in) or umpires (PIN session) may score. Returns who, or null. */
export async function getScoringActor(tournamentId: string): Promise<ScoringActor | null> {
  const user = await getOptionalUser();
  if (user && (await isOrganizerForTournament(user.id, tournamentId))) {
    return { operatorId: user.id, operatorLabel: "Organizer" };
  }
  if (await hasUmpireSession(tournamentId)) {
    return { operatorId: null, operatorLabel: "Umpire" };
  }
  return null;
}

export async function requireScoringActor(tournamentId: string) {
  const actor = await getScoringActor(tournamentId);
  if (!actor) throw new Error("Unauthorized");
  return actor;
}

export async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}
