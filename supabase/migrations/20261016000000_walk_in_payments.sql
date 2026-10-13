-- Walk-in payments: pay at the venue (cash or QR) and entries added at the desk.

-- 1. Per-tournament switch.
ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS allow_walk_in_payment BOOLEAN NOT NULL DEFAULT false;

-- 2. Where an entry came from:
--    online        registered and paid (or will pay) online
--    pay_at_venue  registered online, paying at the desk; holds a slot until paid
--    desk          added by the organizer on the day (players may have no account)
ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS entry_source TEXT NOT NULL DEFAULT 'online'
    CHECK (entry_source IN ('online', 'pay_at_venue', 'desk'));

-- 3. How a payment was made, and who recorded it at the desk.
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS method TEXT NOT NULL DEFAULT 'online'
    CHECK (method IN ('online', 'cash', 'qr')),
  ADD COLUMN IF NOT EXISTS recorded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- desk walk-ins may not have an account
ALTER TABLE public.payments ALTER COLUMN user_id DROP NOT NULL;

-- 4. Cash never passes through the platform, so its platform fee is charged to
--    the organizer's wallet. The balance may go negative; withdrawals already
--    refuse amounts above the balance, so it's settled from later online income.
ALTER TABLE public.organizer_wallets
  DROP CONSTRAINT IF EXISTS organizer_wallets_available_balance_cents_check;

CREATE OR REPLACE FUNCTION public.charge_cash_platform_fee(
  p_user_id UUID,
  p_payment_id UUID,
  p_registration_id UUID,
  p_tournament_id UUID,
  p_platform_fee_cents INTEGER,
  p_gross_cents INTEGER,
  p_description TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_platform_fee_cents < 0 THEN
    RAISE EXCEPTION 'platform fee must be non-negative';
  END IF;

  -- idempotent: one fee per payment
  IF EXISTS (
    SELECT 1 FROM public.wallet_transactions
    WHERE payment_id = p_payment_id AND type = 'platform_fee'
  ) THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.organizer_wallets (user_id, available_balance_cents, currency)
  VALUES (p_user_id, 0, 'PHP')
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.organizer_wallets
  SET available_balance_cents = available_balance_cents - p_platform_fee_cents
  WHERE user_id = p_user_id;

  INSERT INTO public.wallet_transactions (
    wallet_user_id, type, amount_cents, payment_id, registration_id, tournament_id, description, metadata
  ) VALUES (
    p_user_id,
    'platform_fee',
    -p_platform_fee_cents,
    p_payment_id,
    p_registration_id,
    p_tournament_id,
    COALESCE(p_description, 'Platform fee on cash entry'),
    jsonb_build_object(
      'gross_cents', p_gross_cents,
      'platform_fee_cents', p_platform_fee_cents,
      'method', 'cash'
    )
  );

  UPDATE public.payments
  SET
    platform_fee_cents = p_platform_fee_cents,
    organizer_net_cents = p_gross_cents - p_platform_fee_cents,
    credited_to_user_id = p_user_id
  WHERE id = p_payment_id;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.charge_cash_platform_fee(UUID, UUID, UUID, UUID, INTEGER, INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.charge_cash_platform_fee(UUID, UUID, UUID, UUID, INTEGER, INTEGER, TEXT) TO service_role;
