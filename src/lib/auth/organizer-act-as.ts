import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";
import { isSuperAdmin } from "@/lib/auth/is-super-admin";
import { requireUser } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const ORGANIZER_ACT_AS_COOKIE = "rmt_org_act_as";
const ACT_AS_MAX_AGE = 60 * 60 * 8;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type OrganizerActAsContext = {
  organizerId: string;
  fullName: string;
  email: string | null;
};

function isUuid(value: string) {
  return UUID_RE.test(value);
}

/** Super-admin support mode: read validated act-as target from cookie. */
export async function getOrganizerActAsContext(
  user: User | null | undefined
): Promise<OrganizerActAsContext | null> {
  if (!user || !isSuperAdmin(user)) return null;
  const raw = (await cookies()).get(ORGANIZER_ACT_AS_COOKIE)?.value?.trim();
  if (!raw || !isUuid(raw)) return null;

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("id, full_name").eq("id", raw).maybeSingle();
  if (!profile) return null;

  let email: string | null = null;
  try {
    const { data: authUser } = await admin.auth.admin.getUserById(raw);
    email = authUser?.user?.email ?? null;
  } catch {
    // optional
  }

  return {
    organizerId: profile.id,
    fullName: profile.full_name?.trim() || email || "Organizer",
    email,
  };
}

export async function getEffectiveOrganizerId(user: User): Promise<string> {
  const ctx = await getOrganizerActAsContext(user);
  return ctx?.organizerId ?? user.id;
}

/** User-scoped client normally; admin client while super admin is viewing as an organizer. */
export async function createOrganizerDataClient(user: User) {
  const ctx = await getOrganizerActAsContext(user);
  if (ctx && isSuperAdmin(user)) return createAdminClient();
  return createClient();
}

export function organizerActAsCookieOptions() {
  return {
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
    maxAge: ACT_AS_MAX_AGE,
  };
}

/** Signed-in organizer tools: correct Supabase client + effective owner id (incl. super-admin act-as). */
export async function requireOrganizerSession() {
  const user = await requireUser();
  const [supabase, organizerId, actAs] = await Promise.all([
    createOrganizerDataClient(user),
    getEffectiveOrganizerId(user),
    getOrganizerActAsContext(user),
  ]);
  return { user, supabase, organizerId, actAs };
}
