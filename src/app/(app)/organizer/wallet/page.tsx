import Link from "next/link";
import { connection } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";
import { getPlatformFeePercent } from "@/lib/env/server";
import { PageHeader, SectionHeading, StatTile } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTime, formatPhp } from "@/lib/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Wallet } from "lucide-react";
import { relationOne } from "@/lib/supabase/relations";

export const metadata = { title: "Wallet" };

type TxMetadata = {
  gross_cents?: number;
  platform_fee_cents?: number;
  organizer_net_cents?: number;
};

export default async function OrganizerWalletPage() {
  await connection();
  const user = await requireUser();
  const supabase = await createClient();

  const { data: wallet } = await supabase
    .from("organizer_wallets")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: transactions } = await supabase
    .from("wallet_transactions")
    .select(
      "id, type, amount_cents, description, metadata, created_at, tournament_id, tournaments(name, slug)"
    )
    .eq("wallet_user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const { data: ownedTournaments } = await supabase
    .from("tournaments")
    .select("id")
    .eq("owner_id", user.id);

  const tournamentIds = (ownedTournaments ?? []).map((t) => t.id);
  let pendingRegistrations = 0;
  if (tournamentIds.length) {
    const { count } = await supabase
      .from("registrations")
      .select("*", { count: "exact", head: true })
      .in("tournament_id", tournamentIds)
      .eq("payment_status", "pending");
    pendingRegistrations = count ?? 0;
  }

  let lifetimeGross = 0;
  let lifetimeFees = 0;
  for (const tx of transactions ?? []) {
    if (tx.type !== "entry_payment") continue;
    const meta = (tx.metadata ?? {}) as TxMetadata;
    lifetimeGross += meta.gross_cents ?? tx.amount_cents;
    lifetimeFees += meta.platform_fee_cents ?? 0;
  }

  const balanceCents = wallet?.available_balance_cents ?? 0;
  const feePercent = getPlatformFeePercent();

  return (
    <div className="space-y-12">
      <PageHeader
        eyebrow="Organizer"
        title="Wallet"
        description={`Entry payments from your events (after ${feePercent}% platform fee). Withdrawals are handled separately.`}
      />

      <div className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Available balance"
          value={formatPhp(balanceCents)}
          hint="Ledger balance from paid entries"
        />
        <StatTile
          label="Lifetime gross"
          value={formatPhp(lifetimeGross)}
          hint="Total player payments received"
        />
        <StatTile
          label="Platform fees"
          value={formatPhp(lifetimeFees)}
          hint={`${feePercent}% on entry payments`}
        />
        <StatTile
          label="Awaiting payment"
          value={pendingRegistrations}
          hint="Registrations not paid yet"
        />
      </div>

      <section className="space-y-4">
        <SectionHeading title="Transactions" />
        {!transactions?.length ? (
          <EmptyState
            icon={Wallet}
            title="No payments yet"
            description="When players pay entry fees for your tournaments, credits will show up here."
            action={
              <Link
                href="/organizer/tournaments"
                className="text-sm font-medium text-bone underline decoration-umber underline-offset-4 hover:decoration-brass"
              >
                View my events
              </Link>
            }
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-line">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">Fee</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => {
                  const meta = (tx.metadata ?? {}) as TxMetadata;
                  const tournament = relationOne(tx.tournaments) as {
                    name: string;
                    slug: string;
                  } | null;
                  const gross = meta.gross_cents ?? tx.amount_cents;
                  const fee = meta.platform_fee_cents ?? 0;
                  const net = meta.organizer_net_cents ?? tx.amount_cents;
                  return (
                    <TableRow key={tx.id}>
                      <TableCell className="text-muted-foreground">
                        {formatDateTime(tx.created_at)}
                      </TableCell>
                      <TableCell>
                        {tournament ? (
                          <Link
                            href={`/tournaments/${tournament.slug}`}
                            className="text-bone hover:text-brass"
                          >
                            {tournament.name}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="max-w-[12rem] truncate text-muted-foreground">
                        {tx.description ?? tx.type}
                      </TableCell>
                      <TableCell className="text-right font-mono">{formatPhp(gross)}</TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {formatPhp(fee)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-bone">
                        {formatPhp(net)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
