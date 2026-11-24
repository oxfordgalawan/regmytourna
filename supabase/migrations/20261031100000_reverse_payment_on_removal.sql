-- Reverse organizer wallet credits when an organizer removes a paid entry.

CREATE OR REPLACE FUNCTION public.reverse_payment_on_entry_removal(
  p_user_id UUID,
  p_payment_id UUID,
  p_registration_id UUID,
  p_tournament_id UUID,
  p_description TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry public.wallet_transactions%ROWTYPE;
  v_fee public.wallet_transactions%ROWTYPE;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.wallet_transactions
    WHERE payment_id = p_payment_id AND type = 'refund'
  ) THEN
    RETURN FALSE;
  END IF;

  SELECT * INTO v_entry
  FROM public.wallet_transactions
  WHERE payment_id = p_payment_id AND type = 'entry_payment'
  LIMIT 1;

  IF FOUND THEN
    INSERT INTO public.organizer_wallets (user_id, available_balance_cents, currency)
    VALUES (p_user_id, 0, 'PHP')
    ON CONFLICT (user_id) DO NOTHING;

    UPDATE public.organizer_wallets
    SET available_balance_cents = available_balance_cents - v_entry.amount_cents
    WHERE user_id = p_user_id;

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
      'refund',
      -v_entry.amount_cents,
      p_payment_id,
      p_registration_id,
      p_tournament_id,
      COALESCE(p_description, 'Entry removed by organizer'),
      jsonb_build_object(
        'reverses', 'entry_payment',
        'original_amount_cents', v_entry.amount_cents
      )
    );

    RETURN TRUE;
  END IF;

  SELECT * INTO v_fee
  FROM public.wallet_transactions
  WHERE payment_id = p_payment_id AND type = 'platform_fee'
  LIMIT 1;

  IF FOUND THEN
    INSERT INTO public.organizer_wallets (user_id, available_balance_cents, currency)
    VALUES (p_user_id, 0, 'PHP')
    ON CONFLICT (user_id) DO NOTHING;

    UPDATE public.organizer_wallets
    SET available_balance_cents = available_balance_cents - v_fee.amount_cents
    WHERE user_id = p_user_id;

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
      'refund',
      -v_fee.amount_cents,
      p_payment_id,
      p_registration_id,
      p_tournament_id,
      COALESCE(p_description, 'Cash entry removed — platform fee reversed'),
      jsonb_build_object(
        'reverses', 'platform_fee',
        'original_amount_cents', v_fee.amount_cents
      )
    );

    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.reverse_payment_on_entry_removal(
  UUID, UUID, UUID, UUID, TEXT
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.reverse_payment_on_entry_removal(
  UUID, UUID, UUID, UUID, TEXT
) TO service_role;