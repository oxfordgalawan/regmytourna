import { connection } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { getMinWithdrawalCents, getPlatformFeePercent } from "@/lib/env/server";
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
  // make sure every paid entry has reached the wallet before showing it
  await reconcileOrganizerWallet(user.id).catch(() => undefined);
  const o = await loadWalletOverview(user.id);
  const feePercent = getPlatformFeePercent();

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Organizer"
        title="Wallet"
        description={`Online and QR entry payments land here after a ${feePercent}% platform fee. Withdraw any time — an admin approves each payout.`}
      />

      <BalanceCard
        balanceCents={o.balanceCents}
        pendingWithdrawalCents={o.pendingWithdrawalCents}
        monthNetCents={o.monthNetCents}
        minWithdrawalCents={getMinWithdrawalCents()}
        methods={o.methods}
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
