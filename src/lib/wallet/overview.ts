import { createAdminClient } from "@/lib/supabase/admin";
import { relationOne } from "@/lib/supabase/relations";
import { REGISTRATION_PLAYERS_SELECT, registrationName } from "@/lib/registrations/name";
import type { PayoutMethodType } from "@/lib/payout-methods/config";

/**
 * Everything the organizer wallet shows: balance, where the money came from
 * (per event and per channel), activity, payout methods and withdrawals.
 * Server-only; always scoped to one organizer.
 */

export type WalletActivity = {
  id: string;
  kind: "entry" | "cash_fee" | "withdrawal" | "refund" | "adjustment";
  amountCents: number;
  grossCents: number | null;
  feeCents: number | null;
  settlementCents: number | null;
  paymongoFeeCents: number | null;
  channel: "online" | "qr" | "cash" | null;
  title: string;
  subtitle: string | null;
  eventName: string | null;
  status: string | null;
  createdAt: string;
};

export type IncomeByEvent = {
  tournamentId: string;
  name: string;
  slug: string;
  netCents: number;
  grossCents: number;
  feeCents: number;
  entries: number;
};

export type PayoutMethod = {
  id: string;
  label: string;
  method_type: PayoutMethodType;
  account_name: string;
  account_number: string;
  bank_name: string | null;
  notes: string | null;
  is_default: boolean;
};

export type WithdrawalRow = {
  id: string;
  amountCents: number;
  status: string;
  createdAt: string;
  reviewedAt: string | null;
  note: string | null;
  methodLabel: string;
  methodType: PayoutMethodType | null;
};

type TxMeta = {
  gross_cents?: number;
  platform_fee_cents?: number;
  settlement_cents?: number;
  paymongo_fee_cents?: number;
  status?: string;
  reverses?: "entry_payment" | "platform_fee";
  original_amount_cents?: number;
};

type WalletTxRow = {
  id: string;
  type: string;
  amount_cents: number;
  description: string | null;
  metadata: unknown;
  created_at: string;
  tournament_id: string | null;
  payment_id: string | null;
  payments: unknown;
  tournaments: unknown;
  registrations: unknown;
};

function incomeEventSlice(
  byEvent: Map<string, IncomeByEvent>,
  tournamentId: string,
  t: { name: string; slug: string }
): IncomeByEvent {
  return (
    byEvent.get(tournamentId) ?? {
      tournamentId,
      name: t.name,
      slug: t.slug,
      netCents: 0,
      grossCents: 0,
      feeCents: 0,
      entries: 0,
    }
  );
}

export async function loadWalletOverview(userId: string) {
  const admin = createAdminClient();
  const [{ data: wallet }, { data: txs }, { data: methods }, { data: withdrawals }, { data: events }] = await Promise.all([
    admin.from("organizer_wallets").select("*").eq("user_id", userId).maybeSingle(),
    admin
      .from("wallet_transactions")
      .select(
        `id, type, amount_cents, description, metadata, created_at, tournament_id, payment_id, payments(method), tournaments(name, slug), registrations(id, tournament_divisions(name), ${REGISTRATION_PLAYERS_SELECT})`
      )
      .eq("wallet_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(300),
    admin.from("organizer_payout_methods").select("*").eq("user_id", userId).order("is_default", { ascending: false }),
    admin
      .from("withdrawal_requests")
      .select("id, amount_cents, status, created_at, reviewed_at, admin_note, payout_snapshot")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30),
    admin.from("tournaments").select("id, name, slug").eq("owner_id", userId),
  ]);

  // entries still to be paid on this organizer's events
  const eventIds = (events ?? []).map((e) => e.id);
  const { data: unpaid } = eventIds.length
    ? await admin
        .from("registrations")
        .select("id, tournament_divisions(entry_fee_cents), tournaments(entry_fee_cents)")
        .in("tournament_id", eventIds)
        .eq("status", "awaiting_payment")
    : { data: [] };
  const toCollectCents = (unpaid ?? []).reduce((n, r) => {
    const d = relationOne(r.tournament_divisions) as { entry_fee_cents: number | null } | null;
    const t = relationOne(r.tournaments) as { entry_fee_cents: number } | null;
    return n + (d?.entry_fee_cents ?? t?.entry_fee_cents ?? 0);
  }, 0);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const byEvent = new Map<string, IncomeByEvent>();
  const channels = { online: 0, qr: 0, cashFees: 0 };
  let lifetimeNet = 0;
  let lifetimeGross = 0;
  let lifetimeFees = 0;
  let monthNet = 0;

  const entryByPaymentId = new Map<string, WalletTxRow>();
  const feeByPaymentId = new Map<string, WalletTxRow>();
  for (const tx of (txs ?? []) as WalletTxRow[]) {
    if (!tx.payment_id) continue;
    if (tx.type === "entry_payment") entryByPaymentId.set(tx.payment_id, tx);
    else if (tx.type === "platform_fee") feeByPaymentId.set(tx.payment_id, tx);
  }

  const activity: WalletActivity[] = (txs ?? []).map((tx) => {
    const row = tx as WalletTxRow;
    const meta = (row.metadata ?? {}) as TxMeta;
    const t = relationOne(row.tournaments) as { name: string; slug: string } | null;
    const pay = relationOne(row.payments) as { method: string | null } | null;
    const reg = relationOne(row.registrations) as { tournament_divisions: unknown; registration_players?: unknown } | null;
    const category = reg ? (relationOne(reg.tournament_divisions as never) as { name: string } | null)?.name ?? null : null;
    const team = reg ? registrationName(reg) : null;
    const gross = meta.gross_cents ?? null;
    const fee = meta.platform_fee_cents ?? null;

    if (row.type === "entry_payment") {
      const channel = pay?.method === "qr" ? "qr" : "online";
      channels[channel] += row.amount_cents;
      lifetimeNet += row.amount_cents;
      lifetimeGross += gross ?? row.amount_cents;
      lifetimeFees += fee ?? 0;
      if (new Date(row.created_at) >= monthStart) monthNet += row.amount_cents;
      if (row.tournament_id && t) {
        const e = incomeEventSlice(byEvent, row.tournament_id, t);
        e.netCents += row.amount_cents;
        e.grossCents += gross ?? row.amount_cents;
        e.feeCents += fee ?? 0;
        e.entries += 1;
        byEvent.set(row.tournament_id, e);
      }
      return {
        id: row.id,
        kind: "entry",
        amountCents: row.amount_cents,
        grossCents: gross,
        feeCents: fee,
        settlementCents: meta.settlement_cents ?? null,
        paymongoFeeCents: meta.paymongo_fee_cents ?? null,
        channel,
        title: team ?? "Entry payment",
        subtitle: category,
        eventName: t?.name ?? null,
        status: null,
        createdAt: row.created_at,
      } satisfies WalletActivity;
    }
    if (row.type === "platform_fee") {
      channels.cashFees += row.amount_cents;
      lifetimeFees += -row.amount_cents;
      if (row.tournament_id && t) {
        const e = incomeEventSlice(byEvent, row.tournament_id, t);
        e.netCents += row.amount_cents;
        e.feeCents += -row.amount_cents;
        byEvent.set(row.tournament_id, e);
      }
      return {
        id: row.id,
        kind: "cash_fee",
        amountCents: row.amount_cents,
        grossCents: gross,
        feeCents: fee,
        settlementCents: null,
        paymongoFeeCents: null,
        channel: "cash",
        title: team ? `Cash entry · ${team}` : "Platform fee on cash entry",
        subtitle: category,
        eventName: t?.name ?? null,
        status: null,
        createdAt: row.created_at,
      } satisfies WalletActivity;
    }
    if (row.type === "refund") {
      lifetimeNet += row.amount_cents;
      if (new Date(row.created_at) >= monthStart) monthNet += row.amount_cents;

      let refundGross: number | null = null;
      let refundFee: number | null = null;
      let refundChannel: WalletActivity["channel"] = null;

      if (meta.reverses === "entry_payment") {
        const original = row.payment_id ? entryByPaymentId.get(row.payment_id) : undefined;
        const origMeta = (original?.metadata ?? {}) as TxMeta;
        const reversedGross =
          origMeta.gross_cents ?? meta.original_amount_cents ?? Math.abs(row.amount_cents);
        const reversedFee = origMeta.platform_fee_cents ?? 0;

        lifetimeGross -= reversedGross;
        lifetimeFees -= reversedFee;
        refundGross = reversedGross;
        refundFee = reversedFee;

        if (original) {
          const origPay = relationOne(original.payments) as { method: string | null } | null;
          const channel = origPay?.method === "qr" ? "qr" : "online";
          channels[channel] += row.amount_cents;
          refundChannel = channel;
        }

        if (row.tournament_id && t) {
          const e = incomeEventSlice(byEvent, row.tournament_id, t);
          e.netCents += row.amount_cents;
          e.grossCents -= reversedGross;
          e.feeCents -= reversedFee;
          e.entries = Math.max(0, e.entries - 1);
          byEvent.set(row.tournament_id, e);
        }
      } else if (meta.reverses === "platform_fee") {
        channels.cashFees += row.amount_cents;
        lifetimeFees -= row.amount_cents;
        refundChannel = "cash";

        if (row.tournament_id && t) {
          const e = incomeEventSlice(byEvent, row.tournament_id, t);
          e.netCents += row.amount_cents;
          e.feeCents += -row.amount_cents;
          byEvent.set(row.tournament_id, e);
        }
      }

      return {
        id: row.id,
        kind: "refund",
        amountCents: row.amount_cents,
        grossCents: refundGross,
        feeCents: refundFee,
        settlementCents: null,
        paymongoFeeCents: null,
        channel: refundChannel,
        title: row.description ?? "Refund",
        subtitle: null,
        eventName: t?.name ?? null,
        status: null,
        createdAt: row.created_at,
      } satisfies WalletActivity;
    }
    if (row.type === "payout") {
      return {
        id: row.id,
        kind: "withdrawal",
        amountCents: row.amount_cents,
        grossCents: null,
        feeCents: null,
        settlementCents: null,
        paymongoFeeCents: null,
        channel: null,
        title: "Withdrawal",
        subtitle: row.description,
        eventName: null,
        status: meta.status ?? null,
        createdAt: row.created_at,
      } satisfies WalletActivity;
    }
    return {
      id: row.id,
      kind: row.type === "refund" ? "refund" : "adjustment",
      amountCents: row.amount_cents,
      grossCents: null,
      feeCents: null,
      settlementCents: null,
      paymongoFeeCents: null,
      channel: null,
      title: row.description ?? "Adjustment",
      subtitle: null,
      eventName: t?.name ?? null,
      status: null,
      createdAt: row.created_at,
    } satisfies WalletActivity;
  });

  return {
    balanceCents: wallet?.available_balance_cents ?? 0,
    pendingWithdrawalCents: wallet?.pending_withdrawal_cents ?? 0,
    monthNetCents: monthNet,
    lifetimeNetCents: lifetimeNet,
    lifetimeGrossCents: lifetimeGross,
    lifetimeFeesCents: lifetimeFees,
    toCollectCents,
    toCollectCount: (unpaid ?? []).length,
    channels,
    byEvent: [...byEvent.values()].sort((a, b) => b.netCents - a.netCents),
    activity,
    methods: (methods ?? []).map((m) => ({ ...m, method_type: m.method_type as PayoutMethodType })) as PayoutMethod[],
    withdrawals: (withdrawals ?? []).map((w) => {
      const snap = (w.payout_snapshot ?? {}) as { label?: string; method_type?: PayoutMethodType };
      return {
        id: w.id,
        amountCents: w.amount_cents,
        status: w.status,
        createdAt: w.created_at,
        reviewedAt: w.reviewed_at,
        note: w.admin_note,
        methodLabel: snap.label ?? "Payout method",
        methodType: snap.method_type ?? null,
      } satisfies WithdrawalRow;
    }),
  };
}

export type WalletOverview = Awaited<ReturnType<typeof loadWalletOverview>>;
