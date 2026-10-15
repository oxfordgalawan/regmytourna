import { AppAreaLayout } from "@/components/layout/app-area-layout";
import { getOptionalUser } from "@/lib/auth/require-user";
import { getViewRole } from "@/lib/auth/role";
import { isSuperAdmin } from "@/lib/auth/is-super-admin";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // pages below enforce login themselves; the shell only needs the roles
  const user = await getOptionalUser();
  const superAdmin = isSuperAdmin(user);
  const { view, roles } = user
    ? await getViewRole(user.id, { superAdmin })
    : { view: "player" as const, roles: { player: true, organizer: false } };
  return (
    <AppAreaLayout role={view} hasPlayer={roles.player} hasOrganizer={roles.organizer} superAdmin={superAdmin}>
      {children}
    </AppAreaLayout>
  );
}
