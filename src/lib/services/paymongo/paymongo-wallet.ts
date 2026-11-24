import { getServerEnv } from "@/lib/env/server";
import { paymongoPayoutSecretKey, paymongoWalletConfigured } from "@/lib/services/paymongo/paymongo-env";

const PAYMONGO_API = "https://api.paymongo.com";

type WalletListResponse = {
  data?: Array<{
    merchant_id?: string;
    balance?: { available?: number; pending?: number };
    account?: { account_number?: string };
  }>;
  errors?: Array<{ detail?: string }>;
};

export type PaymongoWalletSnapshot =
  | {
      configured: true;
      availableCents: number;
      pendingCents: number;
      accountLast4: string;
      error?: string;
    }
  | {
      configured: false;
      error?: string;
    };

function authHeader(secret: string) {
  return `Basic ${Buffer.from(`${secret}:`).toString("base64")}`;
}

function maskLast4(accountNumber: string) {
  const digits = accountNumber.replace(/\D/g, "");
  return digits.length >= 4 ? digits.slice(-4) : "····";
}

export async function fetchPaymongoWalletSnapshot(): Promise<PaymongoWalletSnapshot> {
  if (!paymongoWalletConfigured()) {
    return { configured: false, error: "PayMongo wallet env not set" };
  }

  const secret = paymongoPayoutSecretKey()!;
  const accountNumber = process.env.PAYMONGO_WALLET_ACCOUNT_NUMBER!.trim();
  const params = new URLSearchParams({ account_number: accountNumber });
  params.append("fields", "balance");
  params.append("fields", "account");

  const res = await fetch(`${PAYMONGO_API}/v2/wallets?${params}`, {
    headers: { Authorization: authHeader(secret) },
    cache: "no-store",
  });

  let json: WalletListResponse = {};
  try {
    json = (await res.json()) as WalletListResponse;
  } catch {
    json = {};
  }

  if (!res.ok) {
    const detail = json.errors?.[0]?.detail ?? `PayMongo wallets ${res.status}`;
    return {
      configured: true,
      availableCents: 0,
      pendingCents: 0,
      accountLast4: maskLast4(accountNumber),
      error: detail,
    };
  }

  const wallets = json.data ?? [];
  const wallet =
    wallets.find((w) => w.account?.account_number?.trim() === accountNumber) ?? wallets[0];
  if (!wallet) {
    return { configured: false, error: "No PayMongo wallet for this account number" };
  }

  return {
    configured: true,
    availableCents: wallet.balance?.available ?? 0,
    pendingCents: wallet.balance?.pending ?? 0,
    accountLast4: maskLast4(wallet.account?.account_number ?? accountNumber),
  };
}

function buildPayoutReferenceNumber(withdrawalId: string, attempt: number) {
  const compact = withdrawalId.replace(/-/g, "").slice(0, 22);
  const ref = `${compact}a${attempt}`;
  return ref.length <= 30 ? ref : ref.slice(0, 30);
}

function extractTransferId(json: {
  data?: { id?: string; transfers?: { id?: string }[] };
  transfers?: { id?: string }[];
}): string | null {
  const candidates = [
    json.data?.transfers?.[0]?.id,
    json.transfers?.[0]?.id,
    json.data?.id,
  ].filter((id): id is string => Boolean(id?.trim()));
  for (const id of candidates) {
    if (id.startsWith("tr_")) return id;
  }
  return candidates[0] ?? null;
}

export async function createPaymongoWithdrawalTransfer(opts: {
  withdrawalId: string;
  amountCents: number;
  destinationNumber: string;
  destinationName: string;
  destinationBic: string;
  attempt?: number;
}): Promise<{ transferId: string }> {
  if (!paymongoWalletConfigured()) {
    throw new Error("PayMongo wallet is not configured on the server.");
  }

  const secret = paymongoPayoutSecretKey()!;
  const sourceNumber = process.env.PAYMONGO_WALLET_ACCOUNT_NUMBER!.trim();
  const sourceName = process.env.PAYMONGO_WALLET_ACCOUNT_NAME!.trim();
  const sourceBic = process.env.PAYMONGO_WALLET_BIC?.trim() || "PAEYPHM2XXX";
  const attempt = Math.max(1, Math.floor(opts.attempt ?? 1));
  const appUrl = getServerEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const callbackUrl = `${appUrl}/api/paymongo/payout-callback`;

  const res = await fetch(`${PAYMONGO_API}/v2/batch_transfers`, {
    method: "POST",
    headers: {
      Authorization: authHeader(secret),
      "Content-Type": "application/json",
      "Idempotency-Key": `wd-${opts.withdrawalId}-a${attempt}`,
    },
    body: JSON.stringify({
      transfers: [
        {
          provider: "instapay",
          amount: opts.amountCents,
          currency: "PHP",
          purpose: "Disbursement",
          description: "RegMyTourna organizer withdrawal",
          reference_number: buildPayoutReferenceNumber(opts.withdrawalId, attempt),
          source_account: { number: sourceNumber, name: sourceName, bic: sourceBic },
          destination_account: {
            number: opts.destinationNumber,
            name: opts.destinationName,
            bic: opts.destinationBic,
          },
          callback_url: callbackUrl,
          metadata: { withdrawal_request_id: opts.withdrawalId, payout_attempt: String(attempt) },
        },
      ],
    }),
  });

  const json = (await res.json().catch(() => ({}))) as {
    errors?: { detail?: string }[];
    data?: { id?: string; transfers?: { id?: string }[] };
    transfers?: { id?: string }[];
  };

  if (!res.ok) {
    throw new Error(json.errors?.[0]?.detail ?? `PayMongo payout failed (${res.status})`);
  }

  const transferId = extractTransferId(json);
  if (!transferId) {
    throw new Error("PayMongo did not return a transfer id. Retry or pay manually.");
  }

  return { transferId };
}