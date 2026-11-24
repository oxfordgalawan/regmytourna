import type { PayoutMethodSnapshot } from "@/lib/payout-methods/config";

const WALLET_BIC: Record<"gcash" | "maya", string> = {
  gcash: "GXCHPHM2XXX",
  maya: "PAPHPHM1XXX",
};

/** InstaPay BIC by label shown in organizer payout methods. */
const BANK_BIC_BY_NAME: Record<string, string> = {
  "BDO Unibank": "BNORPHMM",
  BPI: "BOPIPHMM",
  Metrobank: "MBTCPHMM",
  Landbank: "TLBPPHMM",
  PNB: "PNBMPHMM",
  "Security Bank": "SETCPHMM",
  UnionBank: "UBPHPHMM",
  RCBC: "RCBCPHMM",
  "China Bank": "CHBKPHMM",
  "EastWest Bank": "EWBCPHMM",
  AUB: "AUBKPHMM",
  PSBank: "PHSBPHMM",
  "Robinsons Bank": "ROBPPHMM",
  GoTyme: "GOTYPHM2XXX",
  Maribank: "MBBEPHMM",
};

/** BIC for PayMongo batch_transfers, or null if we cannot send automatically. */
export function instapayBicForSnapshot(snap: PayoutMethodSnapshot): string | null {
  if (snap.method_type === "gcash" || snap.method_type === "maya") {
    return WALLET_BIC[snap.method_type];
  }
  if (snap.method_type === "bank" && snap.bank_name?.trim()) {
    return BANK_BIC_BY_NAME[snap.bank_name.trim()] ?? null;
  }
  return null;
}