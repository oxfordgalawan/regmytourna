import { createAdminClient } from "@/lib/supabase/admin";
import { relationOne } from "@/lib/supabase/relations";
import { REGISTRATION_PLAYERS_SELECT, registrationName } from "@/lib/registrations/name";
import type { PayoutMethodType } from "@/lib/payout-methods/config";
import { loadOrganizerWalletPolicy } from "@/lib/wallet/organizer-fee-profile";

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

export type IncomeEntryLine = {
  id: string;
  label: string;
  netCents: number;
  grossCents: number;
  settlementCents: number | null;
  createdAt: string;
  status: "active" | "removed_refunded";
};

export type IncomeByCategory = {
  categoryId: string | null;
  categoryName: string;
  netCents: number;
  grossCents: number;
  entries: number;
  lines: IncomeEntryLine[];
};

export type IncomeByEvent = {
  tournamentId: string;
  name: string;
  slug: string;
  netCents: number;
  grossCents: number;
  feeCents: number;
  entries: number;
  categories: IncomeByCategory[];
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

type PaymentJoin = {
  method: string | null;
  settlement_cents: number | null;
  paymongo_fee_cents: number | null;
};

type RegistrationJoin = {
  id: string;
  tournament_divisions: unknown;
  registration_players?: unknown;
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
  registration_id: string | null;
  payments: unknown;
  tournaments: unknown;
  registrations: unknown;
};

function incomeNetCents(
  amountCents: number,
  meta: TxMeta,
  pay: PaymentJoin | null,
  settlementEligible: boolean
): number {
  if (!settlementEligible) return amountCents;
  const settlement = pay?.settlement_cents ?? meta.settlement_cents ?? null;
  if (settlement !== null && settlement >= 0) return settlement;
  return amountCents;
}

function divisionFromReg(reg: RegistrationJoin | null) {
  const div = reg
    ? (relationOne(reg.tournament_divisions as never) as { id: string; name: string } | null)
    : null;
  return {
    categoryId: div?.id ?? null,
    categoryKey: div?.id ?? "general",
    categoryName: div?.name ?? "Entries",
  };
}

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
      categories: [],
    }
  );
}

function upsertCategory(
  byEventCategories: Map<string, Map<string, IncomeByCategory>>,
  tournamentId: string,
  categoryKey: string,
  categoryId: string | null,
  categoryName: string
): IncomeByCategory {
  const eventMap = byEventCategories.get(tournamentId) ?? new Map<string, IncomeByCategory>();
  const cat =
    eventMap.get(categoryKey) ??
    ({
      categoryId,
      categoryName,
      netCents: 0,
      grossCents: 0,
      entries: 0,
      lines: [],
    } satisfies IncomeByCategory);
  eventMap.set(categoryKey, cat);
  byEventCategories.set(tournamentId, eventMap);
  return cat;
}

function addEntryLine(
  byEventCategories: Map<string, Map<string, IncomeByCategory>>,
  tournamentId: string,
  division: ReturnType<typeof divisionFromReg>,
  line: IncomeEntryLine
) {
  const cat = upsertCategory(
    byEventCategories,
    tournamentId,
    division.categoryKey,
    division.categoryId,
    division.categoryName
  );
  cat.netCents += line.netCents;
  cat.grossCents += line.grossCents;
  cat.entries += 1;
  cat.lines.push(line);
}

function markEntryRefundedByPaymentId(
  byEventCategories: Map<string, Map<string, IncomeByCategory>>,
  tournamentId: string,
  paymentId: string
): boolean {
  const eventMap = byEventCategories.get(tournamentId);
  if (!eventMap) return false;
  for (const cat of eventMap.values()) {
    const line = cat.lines.find((l) => l.id === paymentId);
    if (!line) continue;
    if (line.status === "removed_refunded") return true;
    cat.netCents -= line.netCents;
    cat.grossCents -= line.grossCents;
    cat.entries = Math.max(0, cat.entries - 1);
    line.status = "removed_refunded";
    return true;
  }
  return false;
}

function appendRemovedEntryLine(
  byEventCategories: Map<string, Map<string, IncomeByCategory>>,
  tournamentId: string,
  division: ReturnType<typeof divisionFromReg>,
  line: IncomeEntryLine
) {
  const cat = upsertCategory(
    byEventCategories,
    tournamentId,
    division.categoryKey,
    division.categoryId,
    division.categoryName
  );
  cat.lines.push(line);
}

export async function loadWalletOverview(userId: string) {
  const admin = createAdminClient();
  const policy = await loadOrganizerWalletPolicy(admin, userId);
  const settlementEligible = policy.settlementEligible;

  const [{ data: wallet }, { data: txs }, { data: methods }, { data: withdrawals }, { data: events }] = await Promise.all([
    admin.from("organizer_wallets").select("*").eq("user_id", userId).maybeSingle(),
    admin
      .from("wallet_transactions")
      .select(
        `id, type, amount_cents, description, metadata, created_at, tournament_id, payment_id, registration_id, payments(method, settlement_cents, paymongo_fee_cents), tournaments(name, slug), registrations(id, tournament_divisions(id, name), ${REGISTRATION_PLAYERS_SELECT})`
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
  const byEventCategories = new Map<string, Map<string, IncomeByCategory>>();
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

  const txsAsc = [...(txs ?? []) as WalletTxRow[]].sort((a, b) =>
    a.created_at.localeCompare(b.created_at)
  );

  for (const row of txsAsc) {
    const meta = (row.metadata ?? {}) as TxMeta;
    const t = relationOne(row.tournaments) as { name: string; slug: string } | null;
    const pay = relationOne(row.payments) as PaymentJoin | null;
    const reg = relationOne(row.registrations) as RegistrationJoin | null;
    const team = reg ? registrationName(reg) : null;
    const gross = meta.gross_cents ?? null;
    const fee = meta.platform_fee_cents ?? null;

    if (row.type === "entry_payment") {
      const creditedNet = incomeNetCents(row.amount_cents, meta, pay, settlementEligible);
      const entryGross = gross ?? row.amount_cents;
      const entryFee =
        settlementEligible && creditedNet !== row.amount_cents
          ? Math.max(0, entryGross - creditedNet)
          : (fee ?? 0);
      const channel = pay?.method === "qr" ? "qr" : "online";
      channels[channel] += creditedNet;
      lifetimeNet += creditedNet;
      lifetimeGross += entryGross;
      lifetimeFees += entryFee;
      if (new Date(row.created_at) >= monthStart) monthNet += creditedNet;
      if (row.tournament_id && t) {
        const e = incomeEventSlice(byEvent, row.tournament_id, t);
        e.netCents += creditedNet;
        e.grossCents += entryGross;
        e.feeCents += entryFee;
        e.entries += 1;
        byEvent.set(row.tournament_id, e);
        const division = divisionFromReg(reg);
        addEntryLine(byEventCategories, row.tournament_id, division, {
          id: row.payment_id ?? row.id,
          label: team ?? "Entry payment",
          netCents: creditedNet,
          grossCents: entryGross,
          settlementCents: pay?.settlement_cents ?? meta.settlement_cents ?? creditedNet,
          createdAt: row.created_at,
          status: "active",
        });
      }
      continue;
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
      continue;
    }

    if (row.type === "refund" && meta.reverses === "entry_payment") {
      const original = row.payment_id ? entryByPaymentId.get(row.payment_id) : undefined;
      const origMeta = (original?.metadata ?? {}) as TxMeta;
      const origPay = original
        ? (relationOne(original.payments) as PaymentJoin | null)
        : null;
      const origReg = original
        ? (relationOne(original.registrations) as RegistrationJoin | null)
        : null;
      const reversedGross =
        origMeta.gross_cents ?? meta.original_amount_cents ?? Math.abs(row.amount_cents);
      const reversedNet = original
        ? incomeNetCents(original.amount_cents, origMeta, origPay, settlementEligible)
        : Math.abs(row.amount_cents);
      const refundNet = -reversedNet;
      const reversedFee =
        settlementEligible && reversedNet !== Math.abs(row.amount_cents)
          ? Math.max(0, reversedGross - reversedNet)
          : origMeta.platform_fee_cents ?? 0;

      lifetimeGross -= reversedGross;
      lifetimeFees -= reversedFee;
      lifetimeNet += refundNet;
      if (new Date(row.created_at) >= monthStart) monthNet += refundNet;

      if (original) {
        const channel = origPay?.method === "qr" ? "qr" : "online";
        channels[channel] += refundNet;
      }

      if (row.tournament_id && t) {
        const e = incomeEventSlice(byEvent, row.tournament_id, t);
        e.netCents += refundNet;
        e.grossCents -= reversedGross;
        e.feeCents -= reversedFee;
        e.entries = Math.max(0, e.entries - 1);
        byEvent.set(row.tournament_id, e);

        if (row.payment_id) {
          const marked = markEntryRefundedByPaymentId(
            byEventCategories,
            row.tournament_id,
            row.payment_id
          );
          if (!marked && original) {
            const division = divisionFromReg(origReg);
            const origTeam = origReg ? registrationName(origReg) : "Removed entry";
            appendRemovedEntryLine(byEventCategories, row.tournament_id, division, {
              id: row.payment_id,
              label: origTeam,
              netCents: reversedNet,
              grossCents: reversedGross,
              settlementCents:
                origPay?.settlement_cents ?? origMeta.settlement_cents ?? reversedNet,
              createdAt: row.created_at,
              status: "removed_refunded",
            });
          }
        }
      }
      continue;
    }

    if (row.type === "refund" && meta.reverses === "platform_fee") {
      lifetimeNet += row.amount_cents;
      if (new Date(row.created_at) >= monthStart) monthNet += row.amount_cents;
      channels.cashFees += row.amount_cents;
      lifetimeFees -= row.amount_cents;
      if (row.tournament_id && t) {
        const e = incomeEventSlice(byEvent, row.tournament_id, t);
        e.netCents += row.amount_cents;
        e.feeCents += -row.amount_cents;
        byEvent.set(row.tournament_id, e);
      }
      continue;
    }
  }

  const activity: WalletActivity[] = (txs ?? []).map((tx) => {
    const row = tx as WalletTxRow;
    const meta = (row.metadata ?? {}) as TxMeta;
    const t = relationOne(row.tournaments) as { name: string; slug: string } | null;
    const pay = relationOne(row.payments) as PaymentJoin | null;
    const reg = relationOne(row.registrations) as RegistrationJoin | null;
    const category = reg ? (relationOne(reg.tournament_divisions as never) as { name: string } | null)?.name ?? null : null;
    const team = reg ? registrationName(reg) : null;
    const gross = meta.gross_cents ?? null;
    const fee = meta.platform_fee_cents ?? null;

    if (row.type === "entry_payment") {
      const channel = pay?.method === "qr" ? "qr" : "online";
      return {
        id: row.id,
        kind: "entry",
        amountCents: row.amount_cents,
        grossCents: gross,
        feeCents: fee,
        settlementCents: pay?.settlement_cents ?? meta.settlement_cents ?? null,
        paymongoFeeCents: pay?.paymongo_fee_cents ?? meta.paymongo_fee_cents ?? null,
        channel,
        title: team ?? "Entry payment",
        subtitle: category,
        eventName: t?.name ?? null,
        status: null,
        createdAt: row.created_at,
      } satisfies WalletActivity;
    }
    if (row.type === "platform_fee") {
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
      let refundGross: number | null = null;
      let refundFee: number | null = null;
      let refundChannel: WalletActivity["channel"] = null;

      if (meta.reverses === "entry_payment") {
        const original = row.payment_id ? entryByPaymentId.get(row.payment_id) : undefined;
        const origMeta = (original?.metadata ?? {}) as TxMeta;
        const origPay = original
          ? (relationOne(original.payments) as PaymentJoin | null)
          : null;
        const reversedGross =
          origMeta.gross_cents ?? meta.original_amount_cents ?? Math.abs(row.amount_cents);
        const reversedNet = original
          ? incomeNetCents(original.amount_cents, origMeta, origPay, settlementEligible)
          : Math.abs(row.amount_cents);
        const reversedFee =
          settlementEligible && reversedNet !== Math.abs(row.amount_cents)
            ? Math.max(0, reversedGross - reversedNet)
            : origMeta.platform_fee_cents ?? 0;

        refundGross = reversedGross;
        refundFee = reversedFee;

        if (original) {
          const channel = origPay?.method === "qr" ? "qr" : "online";
          refundChannel = channel;
        }
      } else if (meta.reverses === "platform_fee") {
        refundChannel = "cash";
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
    settlementDisplay: settlementEligible,
    byEvent: [...byEvent.values()]
      .map((e) => {
        const cats = byEventCategories.get(e.tournamentId);
        const categories = cats
          ? [...cats.values()].sort((a, b) => b.netCents - a.netCents).map((c) => ({
              ...c,
              lines: [...c.lines].sort((a, b) => {
                if (a.status !== b.status) {
                  return a.status === "active" ? -1 : 1;
                }
                return b.createdAt.localeCompare(a.createdAt);
              }),
            }))
          : [];
        return { ...e, categories };
      })
      .sort((a, b) => b.netCents - a.netCents),
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
