import Link from "next/link";
import { connection } from "next/server";
import { Check, Clock, Inbox, X } from "lucide-react";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAuthEmailMap } from "@/lib/super-admin/queries";
import { PageHeader } from "@/components/layout/page-header";
import { formatDateTime, formatPhp } from "@/lib/format";
import { methodTypeLabel, type PayoutMethodType } from "@/lib/payout-methods/config";
import { CopyField, WithdrawalReviewActions } from "@/components/super-admin/withdrawal-review-actions";
import { MethodMark } from "@/components/wallet/payout-method-ui";
import { PlayerAvatar } from "@/components/players/player-avatar";
import { cn } from "@/lib/utils";
import { relationOne } from "@/lib/supabase/relations";

export const metadata = { title: "Withdrawal approvals · Super admin" };

const filters = [
  { key: "pending", label: "To review" },
  { key: "approved", label: "Sent" },
  { key: "rejected", label: "Declined" },
  { key: "all", label: "All" },
] as const;

type Snapshot = {
  label?: string;
  method_type?: PayoutMethodType;
  account_name?: string;
  account_number?: string;
  bank_name?: string | null;
  notes?: string | null;
};

function ago(iso: string) {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default async function SuperAdminWithdrawalsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await connection();
  await requireSuperAdmin();

  const { status: statusParam } = await searchParams;
  const status = filters.some((f) => f.key === statusParam) ? statusParam! : "pending";

  const admin = createAdminClient();
  let query = admin
    .from("withdrawal_requests")
    .select("id, user_id, amount_cents, status, payout_snapshot, admin_note, created_at, reviewed_at, profiles(full_name, avatar_url)")
    .order("created_at", { ascending: status === "pending" })
    .limit(100);
  if (status !== "all") query = query.eq("status", status as "pending" | "approved" | "rejected");

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [{ data: rows }, emailMap, { data: pendingAll }, { data: sentMonth }] = await Promise.all([
    query,
    fetchAuthEmailMap(admin),
    admin.from("withdrawal_requests").select("amount_cents, created_at").eq("status", "pending"),
    admin.from("withdrawal_requests").select("amount_cents").eq("status", "approved").gte("reviewed_at", monthStart.toISOString()),
  ]);

  // each organizer's current wallet, for context while reviewing
  const userIds = [...new Set((rows ?? []).map((r) => r.user_id))];
  const { data: wallets } = userIds.length
    ? await admin.from("organizer_wallets").select("user_id, available_balance_cents").in("user_id", userIds)
    : { data: [] };
  const balance = new Map((wallets ?? []).map((w) => [w.user_id, w.available_balance_cents]));

  const pendingTotal = (pendingAll ?? []).reduce((n, r) => n + r.amount_cents, 0);
  const oldest = (pendingAll ?? []).map((r) => r.created_at).sort()[0];
  const sentTotal = (sentMonth ?? []).reduce((n, r) => n + r.amount_cents, 0);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Platform"
        title="Withdrawal approvals"
        description="Send the money to the organizer's account, then approve. Declined requests go back to their balance."
      />

      <div className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-3">
        <div className="bg-surface p-5">
          <p className="eyebrow">Waiting for review</p>
          <p className="display mt-2 text-4xl text-bone">{pendingAll?.length ?? 0}</p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">{formatPhp(pendingTotal)} total</p>
        </div>
        <div className="bg-surface p-5">
          <p className="eyebrow">Oldest request</p>
          <p className="display mt-2 text-4xl text-bone">{oldest ? ago(oldest) : "—"}</p>
          <p className="mt-1 text-xs text-muted-foreground">Try to clear within 1–2 business days</p>
        </div>
        <div className="bg-surface p-5">
          <p className="eyebrow">Sent this month</p>
          <p className="display mt-2 text-4xl text-bone">{formatPhp(sentTotal)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{sentMonth?.length ?? 0} payouts</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <Link
            key={f.key}
            href={f.key === "pending" ? "/super-admin/withdrawals" : `/super-admin/withdrawals?status=${f.key}`}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm transition-colors",
              status === f.key ? "border-bone bg-bone text-ink" : "border-line text-muted-foreground hover:text-bone"
            )}
          >
            {f.label}
            {f.key === "pending" && pendingAll?.length ? (
              <span className="ml-1.5 rounded-full bg-brass px-1.5 font-mono text-[0.65rem] text-ink">{pendingAll.length}</span>
            ) : null}
          </Link>
        ))}
      </div>

      {!rows?.length ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-line px-6 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-umber/40 text-brass">
            <Inbox className="size-5" />
          </span>
          <p className="mt-4 font-semibold text-bone">{status === "pending" ? "All caught up" : "Nothing here"}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {status === "pending" ? "New withdrawal requests will appear here." : "No requests with this status yet."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((row) => {
            const profile = relationOne(row.profiles) as { full_name: string | null; avatar_url: string | null } | null;
            const name = profile?.full_name || emailMap.get(row.user_id) || "Organizer";
            const snap = (row.payout_snapshot ?? {}) as Snapshot;
            const bal = balance.get(row.user_id);
            return (
              <article key={row.id} className="flex flex-col rounded-2xl border border-line bg-surface">
                <div className="flex items-start gap-3 border-b border-line p-5">
                  <PlayerAvatar name={name} src={profile?.avatar_url} className="size-11 text-sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-bone">{name}</p>
                    <p className="truncate text-xs text-muted-foreground">{emailMap.get(row.user_id) ?? row.user_id.slice(0, 8)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Requested {formatDateTime(row.created_at)} · {ago(row.created_at)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="display text-3xl text-bone">{formatPhp(row.amount_cents)}</p>
                    {typeof bal === "number" && (
                      <p className="font-mono text-[0.65rem] text-muted-foreground">balance left {formatPhp(bal)}</p>
                    )}
                  </div>
                </div>

                <div className="flex gap-3 p-5">
                  <MethodMark type={snap.method_type ?? null} />
                  <div className="min-w-0 flex-1">
                    <p className="px-2 text-sm font-medium text-bone">
                      {snap.label ?? "Payout method"}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {snap.method_type ? methodTypeLabel(snap.method_type) : ""}
                      </span>
                    </p>
                    <div className="mt-1 grid sm:grid-cols-2">
                      {snap.account_name && <CopyField label="Account name" value={snap.account_name} />}
                      {snap.account_number && <CopyField label="Number" value={snap.account_number} mono />}
                      {snap.bank_name && <CopyField label="Bank" value={snap.bank_name} />}
                      {snap.notes && <CopyField label="Notes" value={snap.notes} />}
                    </div>
                  </div>
                </div>

                <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-4">
                  {row.status === "pending" ? (
                    <>
                      <span className="flex items-center gap-1.5 text-xs text-brass">
                        <Clock className="size-3.5" />
                        Waiting for you
                      </span>
                      <WithdrawalReviewActions
                        requestId={row.id}
                        amountCents={row.amount_cents}
                        organizerName={name}
                        payoutSnapshot={row.payout_snapshot as Record<string, unknown>}
                      />
                    </>
                  ) : (
                    <span
                      className={cn(
                        "flex items-center gap-1.5 text-xs",
                        row.status === "approved" ? "text-bone" : "text-[#e58a72]"
                      )}
                    >
                      {row.status === "approved" ? <Check className="size-3.5" /> : <X className="size-3.5" />}
                      {row.status === "approved" ? "Sent" : row.status === "rejected" ? "Declined" : row.status}
                      {row.reviewed_at ? ` · ${formatDateTime(row.reviewed_at)}` : ""}
                      {row.admin_note ? ` · “${row.admin_note}”` : ""}
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
