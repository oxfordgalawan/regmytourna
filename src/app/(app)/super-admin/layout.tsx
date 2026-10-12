import { PageShell } from "@/components/layout/page-shell";
import { SuperAdminNav } from "@/components/layout/super-admin-nav";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";

export const metadata = { title: "Super admin" };

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  await requireSuperAdmin();

  return (
    <PageShell>
      <div className="mx-auto grid max-w-7xl gap-8 px-4 pt-8 pb-20 sm:px-6 md:grid-cols-[13rem_1fr] md:gap-12 md:pt-12">
        <aside>
          <SuperAdminNav />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </PageShell>
  );
}
