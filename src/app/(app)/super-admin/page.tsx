import Link from "next/link";
import { connection } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlatformOverview } from "@/lib/super-admin/queries";
import { PageHeader, SectionHeading, StatTile } from "@/components/layout/page-header";
import { formatDateTime } from "@/lib/format";
import { ChevronRight } from "lucide-react";

export default async function SuperAdminOverviewPage() {
  await connection();
  await requireSuperAdmin();

  const admin = createAdminClient();
  const overview = await getPlatformOverview(admin);

  return (
    <div className="space-y-12">
      <PageHeader
        eyebrow="Platform"
        title="Super admin console"
        description="Read-only view across all organizers, tournaments, and players."
      />

      <div className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Profiles" value={overview.profileCount} hint="All accounts" />
        <StatTile
          label="Organizers"
          value={overview.organizerCount}
          hint="Event owners + organizer accounts"
        />
        <StatTile label="Tournaments" value={overview.tournamentCount} hint="All statuses" />
        <StatTile label="Registrations" value={overview.registrationCount} hint="All entries" />
      </div>

      <section className="space-y-4">
        <SectionHeading title="Tournaments by status" />
        <ul className="flex flex-wrap gap-2">
          {Object.entries(overview.statusCounts).length === 0 ? (
            <li className="text-sm text-muted-foreground">No tournaments yet.</li>
          ) : (
            Object.entries(overview.statusCounts).map(([status, count]) => (
              <li
                key={status}
                className="rounded-full border border-line bg-surface px-4 py-1.5 font-mono text-xs text-bone"
              >
                {status.replace(/_/g, " ")} · {count}
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="space-y-4">
        <SectionHeading
          title="Recent signups"
          action={
            <Link href="/super-admin/players" className="text-sm text-bone underline decoration-umber underline-offset-4 hover:decoration-brass">
              All players
            </Link>
          }
        />
        {!overview.recentProfiles.length ? (
          <p className="text-sm text-muted-foreground">No profiles yet.</p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
            {overview.recentProfiles.map((p) => (
              <li key={p.id}>
                <div className="flex items-center justify-between gap-4 bg-surface px-5 py-3.5">
                  <div>
                    <p className="font-medium text-bone">{p.full_name || "Unnamed"}</p>
                    <p className="text-sm capitalize text-muted-foreground">{p.account_type}</p>
                  </div>
                  <span className="text-sm text-muted-foreground">{formatDateTime(p.created_at)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          { href: "/super-admin/organizers", label: "Browse organizers" },
          { href: "/super-admin/tournaments", label: "Browse tournaments" },
          { href: "/super-admin/players", label: "Browse players" },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3 text-sm font-medium text-bone transition-colors hover:bg-espresso/60"
          >
            {item.label}
            <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </Link>
        ))}
      </section>
    </div>
  );
}
