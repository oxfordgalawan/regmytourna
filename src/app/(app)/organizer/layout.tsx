import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { getAppRole } from "@/lib/auth/role";
import { isSuperAdmin } from "@/lib/auth/is-super-admin";
import { OrganizerActAsBanner } from "@/components/super-admin/organizer-act-as-banner";
import { pendingOrganizerInvites } from "@/lib/organizers/team";
import { OrganizerInvitesCard } from "@/components/organizer/organizer-invites-card";

/** Organizer tools (events, wallet) are for organizers only. */
export default async function OrganizerLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if ((await getAppRole(user.id, { superAdmin: isSuperAdmin(user) })) !== "organizer") redirect("/settings?organize=1");
  const orgInvites = await pendingOrganizerInvites(user.email);
  return (
    <>
      <OrganizerActAsBanner />
      {orgInvites.length > 0 ? (
        <div className="mb-8">
          <OrganizerInvitesCard invites={orgInvites} />
        </div>
      ) : null}
      {children}
    </>
  );
}
