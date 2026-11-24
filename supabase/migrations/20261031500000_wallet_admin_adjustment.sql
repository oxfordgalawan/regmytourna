-- Super-admin wallet adjustments (e.g. legacy cash convenience fee waivers).

CREATE OR REPLACE FUNCTION public.adjust_organizer_wallet_balance(
  p_user_id UUID,
  p_amount_cents INTEGER,
  p_description TEXT,
  p_admin_user_id UUID,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_amount_cents = 0 THEN
    RAISE EXCEPTION 'adjustment amount must be non-zero';
  END IF;

  IF p_description IS NULL OR length(trim(p_description)) < 12 THEN
    RAISE EXCEPTION 'description must explain the adjustment (at least 12 characters)';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'organizer not found';
  END IF;

  INSERT INTO public.organizer_wallets (user_id, available_balance_cents, currency)
  VALUES (p_user_id, 0, 'PHP')
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.organizer_wallets
  SET available_balance_cents = available_balance_cents + p_amount_cents
  WHERE user_id = p_user_id;

  INSERT INTO public.wallet_transactions (
    wallet_user_id,
    type,
    amount_cents,
    description,
    metadata
  ) VALUES (
    p_user_id,
    'adjustment',
    p_amount_cents,
    trim(p_description),
    COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'admin_user_id', p_admin_user_id,
      'adjusted_at', now()
    )
  );

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.adjust_organizer_wallet_balance(UUID, INTEGER, TEXT, UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.adjust_organizer_wallet_balance(UUID, INTEGER, TEXT, UUID, JSONB) TO service_role;

COMMENT ON FUNCTION public.adjust_organizer_wallet_balance IS
  'Credits or debits an organizer wallet with an audit adjustment row. service_role only.';