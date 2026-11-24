import { connection } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { getEffectiveOrganizerId } from "@/lib/auth/organizer-act-as";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMinWithdrawalCents, getPlatformFeePercent } from "@/lib/env/server";
import { getOrganizerFeePercent } from "@/lib/wallet/fees";
import { PageHeader, SectionHeading } from "@/components/layout/page-header";
import { loadWalletOverview } from "@/lib/wallet/overview";
import { reconcileOrganizerWallet } from "@/lib/payments/settle";
import { IncomeSources } from "@/components/wallet/income-sources";
import {
  ActivityList,
  BalanceCard,
  PayoutMethodsList,
  WithdrawalsList,
} from "@/components/wallet/wallet-client";

export const metadata = { title: "Wallet" };

export default async function OrganizerWalletPage() {
  await connection();
  const user = await requireUser();
  const walletUserId = await getEffectiveOrganizerId(user);
  // make sure every paid entry has reached the wallet before showing it
  await reconcileOrganizerWallet(walletUserId).catch(() => undefined);
  const o = await loadWalletOverview(walletUserId);
  const admin = createAdminClient();
  const { data: walletProfile } = await admin
    .from("profiles")
    .select("platform_fee_percent, wallet_credit_settlement")
    .eq("id", walletUserId)
    .maybeSingle();
  const feePercent = getOrganizerFeePercent(walletProfile);
  const creditSettlement = Boolean(walletProfile?.wallet_credit_settlement);
  const feeOverride = walletProfile?.platform_fee_percent !== null && walletProfile?.platform_fee_percent !== undefined;

  const descriptionParts = [
    feeOverride
      ? `This account uses a ${feePercent}% convenience fee (not the default site rate).`
      : `Online and QR entry payments land here after a ${feePercent}% convenience fee.`,
    creditSettlement
      ? "Online credits match PayMongo settlement after their processing fees — not always the full entry amount players paid."
      : null,
    "Withdraw any time — an admin approves each payout.",
  ].filter(Boolean);

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Organizer"
        title="Wallet"
        description={descriptionParts.join(" ")}
      />

      <BalanceCard
        balanceCents={o.balanceCents}
        pendingWithdrawalCents={o.pendingWithdrawalCents}
        monthNetCents={o.monthNetCents}
        minWithdrawalCents={getMinWithdrawalCents()}
        methods={o.methods}
        feePercent={feePercent}
      />

      <section className="space-y-4">
        <SectionHeading title="Where your money comes from" />
        <IncomeSources overview={o} feePercent={feePercent} />
      </section>

      <section className="space-y-4">
        <SectionHeading title="Payout methods" />
        <PayoutMethodsList methods={o.methods} />
      </section>

      <div className="grid gap-10 xl:grid-cols-[1.5fr_1fr]">
        <section className="space-y-4">
          <SectionHeading title="Activity" />
          <ActivityList activity={o.activity} />
        </section>
        <section className="space-y-4">
          <SectionHeading title="Withdrawals" />
          <WithdrawalsList withdrawals={o.withdrawals} />
        </section>
      </div>
    </div>
  );
}
