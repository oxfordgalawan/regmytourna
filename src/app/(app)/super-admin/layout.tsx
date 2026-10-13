import { SuperAdminShell } from "@/components/layout/super-admin-nav";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";

export const metadata = { title: "Super admin" };

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  await requireSuperAdmin();
  return <SuperAdminShell>{children}</SuperAdminShell>;
}
