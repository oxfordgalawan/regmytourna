import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export async function emailsForUserIds(ids: string[]) {
  const admin = createAdminClient();
  const map = new Map<string, string>();
  if (!ids.length) return map;
  const { data, error } = await admin.rpc("auth_emails_for_users", { p_ids: ids });
  if (!error && Array.isArray(data)) {
    for (const r of data as Array<{ id: string; email: string | null }>) {
      if (r.email) map.set(r.id, r.email);
    }
    return map;
  }
  await Promise.all(
    ids.map(async (id) => {
      const { data: u } = await admin.auth.admin.getUserById(id);
      if (u?.user?.email) map.set(id, u.user.email);
    })
  );
  return map;
}

/** Owner + accepted co-organizers, deduped lowercase emails. */
export async function listOrganizerInboxEmails(tournamentId: string): Promise<string[]> {
  const admin = createAdminClient();
  const [{ data: t }, { data: members }] = await Promise.all([
    admin.from("tournaments").select("owner_id").eq("id", tournamentId).maybeSingle(),
    admin.from("tournament_organizers").select("user_id").eq("tournament_id", tournamentId),
  ]);
  if (!t?.owner_id) return [];

  const ids = [t.owner_id, ...(members ?? []).map((m) => m.user_id).filter((id) => id !== t.owner_id)];
  const emails = await emailsForUserIds(ids);
  const out = new Set<string>();
  for (const id of ids) {
    const e = emails.get(id)?.trim().toLowerCase();
    if (e) out.add(e);
  }
  return [...out];
}