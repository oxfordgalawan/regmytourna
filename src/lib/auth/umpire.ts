import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOptionalUser } from "@/lib/auth/require-user";
import { isOrganizerForTournament } from "@/lib/auth/require-organizer";

/**
 * Named umpires: individual PINs, session cookie binds to one roster row.
 * `tournament_umpire_access.access_version` revokes all sessions when bumped.
 */

const SESSION_HOURS = 12;
export const MAX_PIN_ATTEMPTS = 5;
export const LOCKOUT_MINUTES = 10;

const cookieName = (tournamentId: string) => `rmt_umpire_${tournamentId}`;

function secret() {
  const explicit = process.env.UMPIRE_SESSION_SECRET;
  if (explicit) return explicit;
  const base = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base) throw new Error("Set UMPIRE_SESSION_SECRET to enable umpire access");
  return createHash("sha256").update(`umpire:${base}`).digest("hex");
}

/** Roster PINs are exactly 4 digits. */
export function isValidPin(pin: string) {
  return /^\d{4}$/.test(pin);
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

export function generateUmpirePin() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

export async function issueUmpireSession(
  tournamentId: string,
  umpireId: string,
  accessVersion: number
) {
  const expires = Date.now() + SESSION_HOURS * 3_600_000;
  const payload = `${tournamentId}.${umpireId}.${accessVersion}.${expires}`;
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

type SessionPayload = { tournamentId: string; umpireId: string; accessVersion: number };

function parseSessionCookie(raw: string | undefined): SessionPayload | null {
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length !== 5) return null;
  const [tournamentId, umpireId, version, expires, mac] = parts;
  const payload = `${tournamentId}.${umpireId}.${version}.${expires}`;
  const expected = Buffer.from(sign(payload), "hex");
  const given = Buffer.from(mac, "hex");
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  if (Number(expires) < Date.now()) return null;
  return { tournamentId, umpireId, accessVersion: Number(version) };
}

export async function getUmpireSession(tournamentId: string) {
  const raw = (await cookies()).get(cookieName(tournamentId))?.value;
  const parsed = parseSessionCookie(raw);
  if (!parsed || parsed.tournamentId !== tournamentId) return null;

  const access = await getUmpireAccess(tournamentId);
  if (!access || access.access_version !== parsed.accessVersion) return null;

  const { data: umpire } = await createAdminClient()
    .from("tournament_umpires")
    .select("id, name, active, tournament_id")
    .eq("id", parsed.umpireId)
    .eq("tournament_id", tournamentId)
    .maybeSingle();
  if (!umpire?.active) return null;
  return { id: umpire.id as string, name: umpire.name as string };
}

export async function hasUmpireSession(tournamentId: string) {
  return Boolean(await getUmpireSession(tournamentId));
}

export async function getUmpireAccess(tournamentId: string) {
  const { data } = await createAdminClient()
    .from("tournament_umpire_access")
    .select("access_version")
    .eq("tournament_id", tournamentId)
    .maybeSingle();
  if (!data) {
    await createAdminClient()
      .from("tournament_umpire_access")
      .upsert({ tournament_id: tournamentId, access_version: 0 }, { onConflict: "tournament_id" });
    return { access_version: 0 };
  }
  return data as { access_version: number };
}

export async function bumpUmpireAccessVersion(tournamentId: string) {
  const current = await getUmpireAccess(tournamentId);
  const next = (current?.access_version ?? 0) + 1;
  await createAdminClient()
    .from("tournament_umpire_access")
    .upsert(
      { tournament_id: tournamentId, access_version: next, updated_at: new Date().toISOString() },
      { onConflict: "tournament_id" }
    );
  return next;
}

export type ScoringActor = { operatorId: string | null; operatorLabel: string; umpireId?: string };

export async function getScoringActor(tournamentId: string): Promise<ScoringActor | null> {
  const user = await getOptionalUser();
  if (user && (await isOrganizerForTournament(user.id, tournamentId))) {
    return { operatorId: user.id, operatorLabel: "Organizer" };
  }
  const session = await getUmpireSession(tournamentId);
  if (session) {
    return { operatorId: null, operatorLabel: session.name, umpireId: session.id };
  }
  return null;
}

export async function requireScoringActor(tournamentId: string) {
  const actor = await getScoringActor(tournamentId);
  if (!actor) throw new Error("Unauthorized");
  return actor;
}

export async function requireMatchScoringAccess(tournamentId: string, matchId: string) {
  const user = await getOptionalUser();
  if (user && (await isOrganizerForTournament(user.id, tournamentId))) {
    return { operatorId: user.id, operatorLabel: "Organizer" } satisfies ScoringActor;
  }
  const session = await getUmpireSession(tournamentId);
  if (!session) throw new Error("Unauthorized");

  const { data: match } = await createAdminClient()
    .from("matches")
    .select("assigned_umpire_id")
    .eq("id", matchId)
    .eq("tournament_id", tournamentId)
    .maybeSingle();
  if (!match || match.assigned_umpire_id !== session.id) {
    throw new Error("This match is not assigned to you");
  }
  return { operatorId: null, operatorLabel: session.name, umpireId: session.id } satisfies ScoringActor;
}

export async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

/**
 * Organizers can reveal an umpire's PIN, so alongside the hash we keep an
 * encrypted copy (AES-256-GCM, key derived from the server secret). It is only
 * decrypted on demand for one umpire by an organizer of that event.
 */
function pinKey() {
  return createHash("sha256").update(`umpire-pin:${secret()}`).digest();
}

export function encryptPin(pin: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", pinKey(), iv);
  const data = Buffer.concat([cipher.update(pin, "utf8"), cipher.final()]);
  return `v1:${iv.toString("base64")}:${cipher.getAuthTag().toString("base64")}:${data.toString("base64")}`;
}

export function decryptPin(stored: string | null | undefined): string | null {
  if (!stored?.startsWith("v1:")) return null;
  try {
    const [, iv, tag, data] = stored.split(":");
    const decipher = createDecipheriv("aes-256-gcm", pinKey(), Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
