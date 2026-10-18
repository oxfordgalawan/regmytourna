"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ORGANIZER_ACT_AS_COOKIE,
  organizerActAsCookieOptions,
} from "@/lib/auth/organizer-act-as";
import { VIEW_COOKIE } from "@/lib/auth/role";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function startOrganizerActAsAction(
  organizerId: string
): Promise<{ error: string } | never> {
  await requireSuperAdmin();
  const id = organizerId.trim();
  if (!UUID_RE.test(id)) {
    return { error: "Invalid organizer." };
  }

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("id").eq("id", id).maybeSingle();
  if (!profile) {
    return { error: "Organizer not found." };
  }

  const jar = await cookies();
  jar.set(ORGANIZER_ACT_AS_COOKIE, id, organizerActAsCookieOptions());
  jar.set(VIEW_COOKIE, "organizer", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 90,
  });

  redirect("/organizer/tournaments");
}

export async function clearOrganizerActAsAction() {
  await requireSuperAdmin();
  const jar = await cookies();
  jar.delete(ORGANIZER_ACT_AS_COOKIE);
  redirect("/super-admin/organizers");
}
