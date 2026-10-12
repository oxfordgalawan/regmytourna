import { connection } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { listPlatformPlayers } from "@/lib/super-admin/queries";
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

export const metadata = { title: "Players · Super admin" };

export default async function SuperAdminPlayersPage() {
  await connection();
  await requireSuperAdmin();

  const admin = createAdminClient();
  const rows = await listPlatformPlayers(admin);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Platform"
        title="Players"
        description="All profiles with registration and payment summary."
      />

      <div className="overflow-hidden rounded-2xl border border-line">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Account</TableHead>
              <TableHead className="text-right">Entries</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead>Joined</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  No players yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium text-bone">{row.fullName}</TableCell>
                  <TableCell className="text-muted-foreground">{row.email ?? "—"}</TableCell>
                  <TableCell className="capitalize">{row.accountType}</TableCell>
                  <TableCell className="text-right font-mono">{row.registrationCount}</TableCell>
                  <TableCell className="text-right font-mono">{row.paidRegistrationCount}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDateTime(row.createdAt)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
