import { connection } from "next/server";
import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { listPlatformOrganizers } from "@/lib/super-admin/queries";
import { PageHeader } from "@/components/layout/page-header";
import { formatDateTime } from "@/lib/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata = { title: "Organizers · Super admin" };

export default async function SuperAdminOrganizersPage() {
  await connection();
  await requireSuperAdmin();

  const admin = createAdminClient();
  const rows = await listPlatformOrganizers(admin);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Platform"
        title="Organizers"
        description="Accounts that run events or are marked as organizers."
      />

      <div className="overflow-hidden rounded-2xl border border-line">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Account</TableHead>
              <TableHead className="text-right">Events</TableHead>
              <TableHead>Last activity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  No organizers yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium text-bone">{row.fullName}</TableCell>
                  <TableCell className="text-muted-foreground">{row.email ?? "—"}</TableCell>
                  <TableCell className="capitalize">{row.accountType}</TableCell>
                  <TableCell className="text-right font-mono">{row.tournamentCount}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.lastActivity ? formatDateTime(row.lastActivity) : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-sm text-muted-foreground">
        Open the{" "}
        <Link href="/organizer/tournaments" className="text-bone underline decoration-umber underline-offset-4">
          organizer console
        </Link>{" "}
        to manage events as this signed-in user.
      </p>
    </div>
  );
}
