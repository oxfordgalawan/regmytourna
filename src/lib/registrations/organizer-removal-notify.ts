import { createAdminClient } from "@/lib/supabase/admin";
import { sendRegistrationEmail } from "@/lib/email/send";
import { organizerRemovedEntryEmail } from "@/lib/email/team-email";
import { loadTeam } from "@/lib/registrations/team-changes";

async function emailOf(userId: string | null, guestEmail: string | null) {
  if (userId) {
    const { data } = await createAdminClient().auth.admin.getUserById(userId);
    if (data?.user?.email) return data.user.email;
  }
  return guestEmail;
}

/** Emails everyone on the entry after the organizer removes a paid registration. */
export async function notifyPlayersOrganizerRemovedEntry(registrationId: string, organizerName: string) {
  const team = await loadTeam(registrationId);
  if (!team) return;

  const mail = organizerRemovedEntryEmail({ event: team.event, organizerName });

  await Promise.all(
    team.rows.map(async (r) => {
      const to = await emailOf(r.user_id, r.guest_email);
      if (!to) return;
      await sendRegistrationEmail({ to, ...mail }).catch(() => undefined);
    })
  );
}