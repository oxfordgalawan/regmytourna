import { createPaymongoWithdrawalTransfer } from "@/lib/services/paymongo/paymongo-wallet";
import { instapayBicForSnapshot } from "@/lib/payout-methods/instapay-bic";
import { stripAccountNumber, type PayoutMethodSnapshot } from "@/lib/payout-methods/config";

export function payoutDestinationFromSnapshot(snap: PayoutMethodSnapshot) {
  const bic = instapayBicForSnapshot(snap);
  if (!bic) {
    return { error: "This payout method cannot be sent via PayMongo InstaPay. Use GCash, Maya, or a supported bank." as const };
  }
  const number =
    snap.method_type === "bank"
      ? stripAccountNumber(snap.account_number)
      : stripAccountNumber(snap.account_number);
  const name = snap.account_name.trim();
  if (!number || name.length < 2) {
    return { error: "Payout snapshot is missing account name or number." as const };
  }
  return { bic, number, name } as const;
}

export async function sendPaymongoWithdrawalPayout(opts: {
  requestId: string;
  amountCents: number;
  payoutSnapshot: Record<string, unknown>;
  attempt?: number;
}) {
  const snap = opts.payoutSnapshot as PayoutMethodSnapshot & { method_type: PayoutMethodSnapshot["method_type"] };
  const dest = payoutDestinationFromSnapshot(snap);
  if ("error" in dest) {
    return { error: dest.error };
  }

  try {
    const { transferId } = await createPaymongoWithdrawalTransfer({
      withdrawalId: opts.requestId,
      amountCents: opts.amountCents,
      destinationNumber: dest.number,
      destinationName: dest.name,
      destinationBic: dest.bic,
      attempt: opts.attempt,
    });
    return { transferId } as const;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "PayMongo payout failed" };
  }
}