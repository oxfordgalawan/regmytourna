"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { createAdminClient } from "@/lib/supabase/admin";

const WAIVER_DESCRIPTION =
  "Legacy cash convenience fees waived (pre-0% policy)";

const SHORTFALL_DESCRIPTION =
  "Wallet balance correction (refund or withdrawal ledger shortfall)";

async function loadWalletAdminContext(organizerUserId: string) {
  const admin = createAdminClient();

  const [
    { data: profile },
    { data: wallet },
    { data: feeRows },
    { data: legacyWaivedRow },
    { data: shortfallRow },
  ] = await Promise.all([
    admin.from("profiles").select("platform_fee_percent").eq("id", organizerUserId).maybeSingle(),
    admin.from("organizer_wallets").select("available_balance_cents").eq("user_id", organizerUserId).maybeSingle(),
    admin
      .from("wallet_transactions")
      .select("amount_cents")
      .eq("wallet_user_id", organizerUserId)
      .eq("type", "platform_fee"),
    admin
      .from("wallet_transactions")
      .select("id")
      .eq("wallet_user_id", organizerUserId)
      .eq("type", "adjustment")
      .contains("metadata", { legacy_cash_fee_waiver: true })
      .limit(1),
    admin
      .from("wallet_transactions")
      .select("id")
      .eq("wallet_user_id", organizerUserId)
      .eq("type", "adjustment")
      .contains("metadata", { negative_balance_shortfall_credit: true })
      .limit(1),
  ]);

  const platformFeeDebitCents = (feeRows ?? []).reduce(
    (sum, r) => sum + Math.abs(r.amount_cents),
    0
  );
  const balanceCents = wallet?.available_balance_cents ?? 0;

  return {
    profile,
    balanceCents,
    platformFeeDebitCents,
    legacyWaived: (legacyWaivedRow?.length ?? 0) > 0,
    shortfallCredited: (shortfallRow?.length ?? 0) > 0,
  };
}

export async function getOrganizerWalletAdminOptions(organizerUserId: string): Promise<
  | { error: string }
  | {
      balanceCents: number;
      platformFeeDebitCents: number;
      shortfallCreditCents: number;
      canWaiveLegacyCashFees: boolean;
      canCreditShortfall: boolean;
      legacyWaived: boolean;
      shortfallCredited: boolean;
    }
> {
  await requireSuperAdmin();
  const ctx = await loadWalletAdminContext(organizerUserId);
  if (!ctx.profile) return { error: "Organizer not found." };

  const onZeroFee = ctx.profile.platform_fee_percent === 0;
  const canWaiveLegacyCashFees =
    onZeroFee && !ctx.legacyWaived && ctx.platformFeeDebitCents > 0;
  const canCreditShortfall =
    onZeroFee &&
    ctx.balanceCents < 0 &&
    ctx.platformFeeDebitCents === 0 &&
    !ctx.shortfallCredited;

  return {
    balanceCents: ctx.balanceCents,
    platformFeeDebitCents: ctx.platformFeeDebitCents,
    shortfallCreditCents: ctx.balanceCents < 0 ? Math.abs(ctx.balanceCents) : 0,
    canWaiveLegacyCashFees,
    canCreditShortfall,
    legacyWaived: ctx.legacyWaived,
    shortfallCredited: ctx.shortfallCredited,
  };
}

export async function previewLegacyCashFeeWaiver(organizerUserId: string): Promise<
  | { error: string }
  | {
      creditCents: number;
      platformFeeDebitCents: number;
      balanceCents: number;
      alreadyWaived: boolean;
    }
> {
  await requireSuperAdmin();
  const ctx = await loadWalletAdminContext(organizerUserId);

  if (!ctx.profile) return { error: "Organizer not found." };
  if (ctx.profile.platform_fee_percent !== 0) {
    return { error: "Legacy waiver applies only to organizers on 0% convenience fee." };
  }

  return {
    creditCents: ctx.platformFeeDebitCents,
    platformFeeDebitCents: ctx.platformFeeDebitCents,
    balanceCents: ctx.balanceCents,
    alreadyWaived: ctx.legacyWaived,
  };
}

export async function waiveLegacyCashFeesForOrganizer(input: {
  organizerUserId: string;
  note?: string;
}): Promise<{ error: string } | { creditedCents: number }> {
  const adminUser = await requireSuperAdmin();
  const preview = await previewLegacyCashFeeWaiver(input.organizerUserId);
  if ("error" in preview) return preview;

  if (preview.alreadyWaived) {
    return { error: "Legacy cash fees were already waived for this organizer." };
  }

  if (preview.creditCents <= 0) {
    return { error: "No legacy cash platform fee debits to waive." };
  }

  const description =
    input.note?.trim() && input.note.trim().length >= 12
      ? input.note.trim()
      : WAIVER_DESCRIPTION;

  const admin = createAdminClient();
  const { error } = await admin.rpc("adjust_organizer_wallet_balance", {
    p_user_id: input.organizerUserId,
    p_amount_cents: preview.creditCents,
    p_description: description,
    p_admin_user_id: adminUser.id,
    p_metadata: {
      legacy_cash_fee_waiver: true,
      platform_fee_debit_cents: preview.platformFeeDebitCents,
    },
  });

  if (error) return { error: error.message };

  revalidatePath("/super-admin/organizers");
  revalidatePath("/organizer/wallet");

  return { creditedCents: preview.creditCents };
}

export async function creditNegativeBalanceShortfall(input: {
  organizerUserId: string;
  note?: string;
}): Promise<{ error: string } | { creditedCents: number }> {
  const adminUser = await requireSuperAdmin();
  const options = await getOrganizerWalletAdminOptions(input.organizerUserId);
  if ("error" in options) return options;

  if (!options.canCreditShortfall) {
    if (options.platformFeeDebitCents > 0) {
      return { error: "Use Waive legacy cash fees for this account." };
    }
    if (options.shortfallCredited) {
      return { error: "A shortfall correction was already applied." };
    }
    if (options.balanceCents >= 0) {
      return { error: "Balance is not negative." };
    }
    return { error: "This correction is not available for this account." };
  }

  const description =
    input.note?.trim() && input.note.trim().length >= 12
      ? input.note.trim()
      : SHORTFALL_DESCRIPTION;

  const admin = createAdminClient();
  const { error } = await admin.rpc("adjust_organizer_wallet_balance", {
    p_user_id: input.organizerUserId,
    p_amount_cents: options.shortfallCreditCents,
    p_description: description,
    p_admin_user_id: adminUser.id,
    p_metadata: {
      negative_balance_shortfall_credit: true,
      balance_before_cents: options.balanceCents,
    },
  });

  if (error) return { error: error.message };

  revalidatePath("/super-admin/organizers");
  revalidatePath("/organizer/wallet");

  return { creditedCents: options.shortfallCreditCents };
}