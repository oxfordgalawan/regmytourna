import { connection } from "next/server";
import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { listPlatformTournaments } from "@/lib/super-admin/queries";
import { PageHeader } from "@/components/layout/page-header";
import { formatDateRange } from "@/lib/format";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ExternalLink } from "lucide-react";

export const metadata = { title: "Tournaments · Super admin" };

export default async function SuperAdminTournamentsPage() {
  await connection();
  await requireSuperAdmin();

  const admin = createAdminClient();
  const rows = await listPlatformTournaments(admin);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Platform"
        title="Tournaments"
        description="Every event on the platform, including drafts and demos."
      />

      <div className="overflow-hidden rounded-2xl border border-line">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Event</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead>City</TableHead>
              <TableHead className="text-right">Entries</TableHead>
              <TableHead>Public</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  No tournaments yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium text-bone">{row.name}</span>
                      {row.isDemo && (
                        <span className="font-mono text-[0.65rem] uppercase tracking-wider text-brass">
                          Demo
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{row.ownerName}</TableCell>
                  <TableCell>
                    <StatusBadge status={row.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateRange(row.startDate, row.endDate)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{row.city ?? "—"}</TableCell>
                  <TableCell className="text-right font-mono">{row.registrationCount}</TableCell>
                  <TableCell>
                    <Link
                      href={`/tournaments/${row.slug}`}
                      className="inline-flex items-center gap-1 text-sm text-bone hover:text-brass"
                    >
                      View
                      <ExternalLink className="size-3.5" aria-hidden />
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
