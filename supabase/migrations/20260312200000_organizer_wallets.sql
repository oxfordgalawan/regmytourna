CREATE TYPE public.wallet_transaction_type AS ENUM (
  'entry_payment',
  'platform_fee',
  'refund',
  'payout',
  'adjustment'
);

CREATE TABLE public.organizer_wallets (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  available_balance_cents INTEGER NOT NULL DEFAULT 0 CHECK (available_balance_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'PHP',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER organizer_wallets_updated_at
  BEFORE UPDATE ON public.organizer_wallets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type public.wallet_transaction_type NOT NULL,
  amount_cents INTEGER NOT NULL,
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  registration_id UUID REFERENCES public.registrations(id) ON DELETE SET NULL,
  tournament_id UUID REFERENCES public.tournaments(id) ON DELETE SET NULL,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX wallet_transactions_payment_type_unique
  ON public.wallet_transactions (payment_id, type)
  WHERE payment_id IS NOT NULL;

CREATE INDEX wallet_transactions_wallet_user_idx ON public.wallet_transactions (wallet_user_id);
CREATE INDEX wallet_transactions_created_at_idx ON public.wallet_transactions (created_at DESC);

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS platform_fee_cents INTEGER,
  ADD COLUMN IF NOT EXISTS organizer_net_cents INTEGER,
  ADD COLUMN IF NOT EXISTS credited_to_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.credit_organizer_wallet(
  p_user_id UUID,
  p_organizer_net_cents INTEGER,
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
    jsonb_build_object(
      'gross_cents', p_gross_cents,
      'platform_fee_cents', p_platform_fee_cents,
      'organizer_net_cents', p_organizer_net_cents
    )
  );

  UPDATE public.payments
  SET
    platform_fee_cents = p_platform_fee_cents,
    organizer_net_cents = p_organizer_net_cents,
    credited_to_user_id = p_user_id
  WHERE id = p_payment_id
    AND credited_to_user_id IS NULL;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.credit_organizer_wallet(
  UUID, INTEGER, UUID, UUID, UUID, INTEGER, INTEGER, TEXT
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.credit_organizer_wallet(
  UUID, INTEGER, UUID, UUID, UUID, INTEGER, INTEGER, TEXT
) TO service_role;

ALTER TABLE public.organizer_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY organizer_wallets_select_own ON public.organizer_wallets
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY wallet_transactions_select_own ON public.wallet_transactions
  FOR SELECT TO authenticated
  USING (wallet_user_id = auth.uid());

CREATE POLICY wallet_transactions_select_tournament_organizer ON public.wallet_transactions
  FOR SELECT TO authenticated
  USING (
    tournament_id IS NOT NULL
    AND public.is_tournament_organizer(tournament_id, auth.uid())
  );
