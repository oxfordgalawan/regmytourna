-- Per-organizer convenience fee override and PayMongo settlement-based wallet credits.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS platform_fee_percent INTEGER
    CHECK (platform_fee_percent IS NULL OR (platform_fee_percent >= 0 AND platform_fee_percent <= 100)),
  ADD COLUMN IF NOT EXISTS wallet_credit_settlement BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS settlement_cents INTEGER
    CHECK (settlement_cents IS NULL OR settlement_cents >= 0),
  ADD COLUMN IF NOT EXISTS paymongo_fee_cents INTEGER
    CHECK (paymongo_fee_cents IS NULL OR paymongo_fee_cents >= 0);

COMMENT ON COLUMN public.profiles.platform_fee_percent IS 'Overrides PLATFORM_FEE_PERCENT when set (0–100).';
COMMENT ON COLUMN public.profiles.wallet_credit_settlement IS 'When true, online/QR wallet credit uses PayMongo settlement (after PayMongo fees), not entry gross.';

UPDATE public.profiles p
SET
  platform_fee_percent = 0,
  wallet_credit_settlement = true
FROM auth.users u
WHERE u.id = p.id AND lower(u.email) = 'neilandrewfuerzas@gmail.com';

DROP FUNCTION IF EXISTS public.credit_organizer_wallet(
  UUID, INTEGER, UUID, UUID, UUID, INTEGER, INTEGER, TEXT
);

CREATE OR REPLACE FUNCTION public.credit_organizer_wallet(
  p_user_id UUID,
  p_organizer_net_cents INTEGER,
  p_payment_id UUID,
  p_registration_id UUID,
  p_tournament_id UUID,
  p_platform_fee_cents INTEGER,
  p_gross_cents INTEGER,
  p_description TEXT DEFAULT NULL,
  p_settlement_cents INTEGER DEFAULT NULL,
  p_paymongo_fee_cents INTEGER DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_organizer_net_cents < 0 THEN
    RAISE EXCEPTION 'organizer net must be non-negative';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.wallet_transactions
    WHERE payment_id = p_payment_id AND type = 'entry_payment'
  ) THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.organizer_wallets (user_id, available_balance_cents, currency)
  VALUES (p_user_id, 0, 'PHP')
  ON CONFLICT (user_id) DO NOTHING;

  IF p_organizer_net_cents > 0 THEN
    UPDATE public.organizer_wallets
    SET available_balance_cents = available_balance_cents + p_organizer_net_cents
    WHERE user_id = p_user_id;
  END IF;

  INSERT INTO public.wallet_transactions (
    wallet_user_id,
    type,
    amount_cents,
    payment_id,
    registration_id,
    tournament_id,
    description,
    metadata
  ) VALUES (
    p_user_id,
    'entry_payment',
    p_organizer_net_cents,
    p_payment_id,
    p_registration_id,
    p_tournament_id,
    COALESCE(p_description, 'Entry payment'),
    jsonb_strip_nulls(
      jsonb_build_object(
        'gross_cents', p_gross_cents,
        'platform_fee_cents', p_platform_fee_cents,
        'organizer_net_cents', p_organizer_net_cents,
        'settlement_cents', p_settlement_cents,
        'paymongo_fee_cents', p_paymongo_fee_cents
      )
    )
  );

  UPDATE public.payments
  SET
    platform_fee_cents = p_platform_fee_cents,
    organizer_net_cents = p_organizer_net_cents,
    credited_to_user_id = p_user_id,
    settlement_cents = COALESCE(p_settlement_cents, settlement_cents),
    paymongo_fee_cents = COALESCE(p_paymongo_fee_cents, paymongo_fee_cents)
  WHERE id = p_payment_id
    AND credited_to_user_id IS NULL;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.credit_organizer_wallet(
  UUID, INTEGER, UUID, UUID, UUID, INTEGER, INTEGER, TEXT, INTEGER, INTEGER
) TO service_role;