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

type TxMeta = { gross_cents?: number; platform_fee_cents?: number; status?: string };

export async function loadWalletOverview(userId: string) {
  const admin = createAdminClient();
  const [{ data: wallet }, { data: txs }, { data: methods }, { data: withdrawals }, { data: events }] = await Promise.all([
    admin.from("organizer_wallets").select("*").eq("user_id", userId).maybeSingle(),
    admin
      .from("wallet_transactions")
      .select(
        `id, type, amount_cents, description, metadata, created_at, tournament_id, payments(method), tournaments(name, slug), registrations(id, tournament_divisions(name), ${REGISTRATION_PLAYERS_SELECT})`
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

  const activity: WalletActivity[] = (txs ?? []).map((tx) => {
    const meta = (tx.metadata ?? {}) as TxMeta;
    const t = relationOne(tx.tournaments) as { name: string; slug: string } | null;
    const pay = relationOne(tx.payments) as { method: string | null } | null;
    const reg = relationOne(tx.registrations) as { tournament_divisions: unknown; registration_players?: unknown } | null;
    const category = reg ? (relationOne(reg.tournament_divisions as never) as { name: string } | null)?.name ?? null : null;
    const team = reg ? registrationName(reg) : null;
    const gross = meta.gross_cents ?? null;
    const fee = meta.platform_fee_cents ?? null;

    if (tx.type === "entry_payment") {
      const channel = pay?.method === "qr" ? "qr" : "online";
      channels[channel] += tx.amount_cents;
      lifetimeNet += tx.amount_cents;
      lifetimeGross += gross ?? tx.amount_cents;
      lifetimeFees += fee ?? 0;
      if (new Date(tx.created_at) >= monthStart) monthNet += tx.amount_cents;
      if (tx.tournament_id && t) {
        const e = byEvent.get(tx.tournament_id) ?? {
          tournamentId: tx.tournament_id,
          name: t.name,
          slug: t.slug,
          netCents: 0,
          grossCents: 0,
          feeCents: 0,
          entries: 0,
        };
        e.netCents += tx.amount_cents;
        e.grossCents += gross ?? tx.amount_cents;
        e.feeCents += fee ?? 0;
        e.entries += 1;
        byEvent.set(tx.tournament_id, e);
      }
      return {
        id: tx.id,
        kind: "entry",
        amountCents: tx.amount_cents,
        grossCents: gross,
        feeCents: fee,
        channel,
        title: team ?? "Entry payment",
        subtitle: category,
        eventName: t?.name ?? null,
        status: null,
        createdAt: tx.created_at,
      } satisfies WalletActivity;
    }
    if (tx.type === "platform_fee") {
      channels.cashFees += tx.amount_cents;
      lifetimeFees += -tx.amount_cents;
      if (tx.tournament_id && t) {
        const e = byEvent.get(tx.tournament_id) ?? {
          tournamentId: tx.tournament_id,
          name: t.name,
          slug: t.slug,
          netCents: 0,
          grossCents: 0,
          feeCents: 0,
          entries: 0,
        };
        e.netCents += tx.amount_cents;
        e.feeCents += -tx.amount_cents;
        byEvent.set(tx.tournament_id, e);
      }
      return {
        id: tx.id,
        kind: "cash_fee",
        amountCents: tx.amount_cents,
        grossCents: gross,
        feeCents: fee,
        channel: "cash",
        title: team ? `Cash entry · ${team}` : "Platform fee on cash entry",
        subtitle: category,
        eventName: t?.name ?? null,
        status: null,
        createdAt: tx.created_at,
      } satisfies WalletActivity;
    }
    if (tx.type === "payout") {
      return {
        id: tx.id,
        kind: "withdrawal",
        amountCents: tx.amount_cents,
        grossCents: null,
        feeCents: null,
        channel: null,
        title: "Withdrawal",
        subtitle: tx.description,
        eventName: null,
        status: meta.status ?? null,
        createdAt: tx.created_at,
      } satisfies WalletActivity;
    }
    return {
      id: tx.id,
      kind: tx.type === "refund" ? "refund" : "adjustment",
      amountCents: tx.amount_cents,
      grossCents: null,
      feeCents: null,
      channel: null,
      title: tx.description ?? (tx.type === "refund" ? "Refund" : "Adjustment"),
      subtitle: null,
      eventName: t?.name ?? null,
      status: null,
      createdAt: tx.created_at,
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
