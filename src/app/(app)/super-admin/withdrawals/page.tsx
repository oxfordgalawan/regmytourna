import Link from "next/link";
import { connection } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAuthEmailMap } from "@/lib/super-admin/queries";
import { PageHeader, SectionHeading } from "@/components/layout/page-header";
import { formatDateTime, formatPhp } from "@/lib/format";
import { methodTypeLabel, type PayoutMethodType } from "@/lib/payout-methods/config";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { WithdrawalReviewActions } from "@/components/super-admin/withdrawal-review-actions";
import { cn } from "@/lib/utils";
import { relationOne } from "@/lib/supabase/relations";

export const metadata = { title: "Withdrawals · Super admin" };

const filters = ["pending", "approved", "rejected", "all"] as const;

export default async function SuperAdminWithdrawalsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await connection();
  await requireSuperAdmin();

  const { status: statusParam } = await searchParams;
  const status =
    filters.includes(statusParam as (typeof filters)[number]) ? statusParam : "pending";

  const admin = createAdminClient();
  let query = admin
    .from("withdrawal_requests")
    .select("id, user_id, amount_cents, status, payout_snapshot, created_at, profiles(full_name)")
    .order("created_at", { ascending: false })
    .limit(100);

  if (status !== "all") {
    query = query.eq("status", status);
  }

  const [{ data: rows }, emailMap] = await Promise.all([query, fetchAuthEmailMap(admin)]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Platform"
        title="Withdrawals"
        description="Review organizer wallet withdrawal requests and copy payout details for manual transfer."
      />

      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <Link
            key={f}
            href={f === "pending" ? "/super-admin/withdrawals" : `/super-admin/withdrawals?status=${f}`}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm capitalize transition-colors",
              status === f
                ? "border-brass bg-espresso text-bone"
                : "border-line text-muted-foreground hover:text-bone"
            )}
          >
            {f}
          </Link>
        ))}
      </div>

      <section className="space-y-4">
        <SectionHeading title={`Requests · ${status}`} />
        <div className="overflow-hidden rounded-2xl border border-line">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Organizer</TableHead>
                <TableHead>Method</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!rows?.length ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    No withdrawal requests.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => {
                  const profile = relationOne(row.profiles);
                  const snap = row.payout_snapshot as {
                    label?: string;
                    method_type?: PayoutMethodType;
                  };
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="text-muted-foreground">
                        {formatDateTime(row.created_at)}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-bone">{profile?.full_name ?? "—"}</p>
                          <p className="text-xs text-muted-foreground">
                            {emailMap.get(row.user_id) ?? row.user_id.slice(0, 8)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {snap.label ?? "—"} ·{" "}
                        {snap.method_type ? methodTypeLabel(snap.method_type) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono">{formatPhp(row.amount_cents)}</TableCell>
                      <TableCell className="capitalize">{row.status}</TableCell>
                      <TableCell>
                        <WithdrawalReviewActions
                          requestId={row.id}
                          payoutSnapshot={row.payout_snapshot as Record<string, unknown>}
                          status={row.status}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
