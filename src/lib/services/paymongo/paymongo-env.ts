/** Secret key for wallet payouts and balance (v2 wallets / batch_transfers). */
export function paymongoPayoutSecretKey(): string | undefined {
  const payout = process.env.PAYMONGO_PAYOUT_SECRET_KEY?.trim();
  if (payout) return payout;
  return process.env.PAYMONGO_SECRET_KEY?.trim() || undefined;
}

export function paymongoWalletConfigured(): boolean {
  return Boolean(
    paymongoPayoutSecretKey() &&
      process.env.PAYMONGO_WALLET_ACCOUNT_NUMBER?.trim() &&
      process.env.PAYMONGO_WALLET_ACCOUNT_NAME?.trim()
  );
}