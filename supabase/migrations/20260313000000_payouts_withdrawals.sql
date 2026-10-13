CREATE TYPE public.payout_method_type AS ENUM ('gcash', 'maya', 'bank', 'other');

CREATE TYPE public.withdrawal_request_status AS ENUM (
  'pending',
  'approved',
  'rejected',
  'cancelled'
);

ALTER TABLE public.organizer_wallets
  ADD COLUMN IF NOT EXISTS pending_withdrawal_cents INTEGER NOT NULL DEFAULT 0
  CHECK (pending_withdrawal_cents >= 0);

CREATE TABLE public.organizer_payout_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  method_type public.payout_method_type NOT NULL,
  account_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  bank_name TEXT,
  notes TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX organizer_payout_methods_user_idx ON public.organizer_payout_methods (user_id);

CREATE TRIGGER organizer_payout_methods_updated_at
  BEFORE UPDATE ON public.organizer_payout_methods
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency TEXT NOT NULL DEFAULT 'PHP',
  status public.withdrawal_request_status NOT NULL DEFAULT 'pending',
  payout_method_id UUID REFERENCES public.organizer_payout_methods(id) ON DELETE SET NULL,
  payout_snapshot JSONB NOT NULL,
  admin_note TEXT,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX withdrawal_requests_user_idx ON public.withdrawal_requests (user_id);
CREATE INDEX withdrawal_requests_status_idx ON public.withdrawal_requests (status);

CREATE TRIGGER withdrawal_requests_updated_at
  BEFORE UPDATE ON public.withdrawal_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.wallet_transactions
  ADD COLUMN IF NOT EXISTS withdrawal_request_id UUID REFERENCES public.withdrawal_requests(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.request_wallet_withdrawal(
  p_user_id UUID,
  p_amount_cents INTEGER,
  p_payout_method_id UUID,
  p_min_amount_cents INTEGER DEFAULT 10000
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_method public.organizer_payout_methods%ROWTYPE;
  v_available INTEGER;
  v_request_id UUID;
  v_snapshot JSONB;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF p_amount_cents < p_min_amount_cents THEN
    RAISE EXCEPTION 'amount below minimum withdrawal';
  END IF;

  SELECT * INTO v_method
  FROM public.organizer_payout_methods
  WHERE id = p_payout_method_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'payout method not found';
  END IF;

  INSERT INTO public.organizer_wallets (user_id, available_balance_cents, pending_withdrawal_cents, currency)
  VALUES (p_user_id, 0, 0, 'PHP')
  ON CONFLICT (user_id) DO NOTHING;

  SELECT available_balance_cents INTO v_available
  FROM public.organizer_wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_available IS NULL OR v_available < p_amount_cents THEN
    RAISE EXCEPTION 'insufficient balance';
  END IF;

  v_snapshot := jsonb_build_object(
    'label', v_method.label,
    'method_type', v_method.method_type,
    'account_name', v_method.account_name,
    'account_number', v_method.account_number,
    'bank_name', v_method.bank_name,
    'notes', v_method.notes
  );

  UPDATE public.organizer_wallets
  SET
    available_balance_cents = available_balance_cents - p_amount_cents,
    pending_withdrawal_cents = pending_withdrawal_cents + p_amount_cents
  WHERE user_id = p_user_id;

  INSERT INTO public.withdrawal_requests (
    user_id,
    amount_cents,
    currency,
    status,
    payout_method_id,
    payout_snapshot
  ) VALUES (
    p_user_id,
    p_amount_cents,
    'PHP',
    'pending',
    p_payout_method_id,
    v_snapshot
  )
  RETURNING id INTO v_request_id;

  INSERT INTO public.wallet_transactions (
    wallet_user_id,
    type,
    amount_cents,
    withdrawal_request_id,
    description,
    metadata
  ) VALUES (
    p_user_id,
    'payout',
    -p_amount_cents,
    v_request_id,
    'Withdrawal request (pending approval)',
    jsonb_build_object('withdrawal_request_id', v_request_id, 'status', 'pending')
  );

  RETURN v_request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_wallet_withdrawal(
  p_request_id UUID,
  p_action TEXT,
  p_admin_user_id UUID,
  p_note TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.withdrawal_requests%ROWTYPE;
BEGIN
  IF p_action NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'invalid action';
  END IF;

  SELECT * INTO v_req
  FROM public.withdrawal_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'request not found';
  END IF;

  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'request already reviewed';
  END IF;

  IF p_action = 'approve' THEN
    UPDATE public.organizer_wallets
    SET pending_withdrawal_cents = pending_withdrawal_cents - v_req.amount_cents
    WHERE user_id = v_req.user_id;

    UPDATE public.withdrawal_requests
    SET
      status = 'approved',
      reviewed_by = p_admin_user_id,
      reviewed_at = now(),
      admin_note = p_note
    WHERE id = p_request_id;

    UPDATE public.wallet_transactions
    SET
      description = 'Withdrawal approved',
      metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('status', 'approved')
    WHERE withdrawal_request_id = p_request_id AND type = 'payout';
  ELSE
    UPDATE public.organizer_wallets
    SET
      available_balance_cents = available_balance_cents + v_req.amount_cents,
      pending_withdrawal_cents = pending_withdrawal_cents - v_req.amount_cents
    WHERE user_id = v_req.user_id;

    UPDATE public.withdrawal_requests
    SET
      status = 'rejected',
      reviewed_by = p_admin_user_id,
      reviewed_at = now(),
      admin_note = p_note
    WHERE id = p_request_id;

    UPDATE public.wallet_transactions
    SET
      description = 'Withdrawal rejected',
      metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('status', 'rejected')
    WHERE withdrawal_request_id = p_request_id AND type = 'payout';

    INSERT INTO public.wallet_transactions (
      wallet_user_id,
      type,
      amount_cents,
      withdrawal_request_id,
      description,
      metadata
    ) VALUES (
      v_req.user_id,
      'adjustment',
      v_req.amount_cents,
      p_request_id,
      'Withdrawal rejected — balance restored',
      jsonb_build_object('withdrawal_request_id', p_request_id, 'status', 'rejected')
    );
  END IF;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.request_wallet_withdrawal(UUID, INTEGER, UUID, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.review_wallet_withdrawal(UUID, TEXT, UUID, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.request_wallet_withdrawal(UUID, INTEGER, UUID, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.review_wallet_withdrawal(UUID, TEXT, UUID, TEXT) TO service_role;

ALTER TABLE public.organizer_payout_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY organizer_payout_methods_select_own ON public.organizer_payout_methods
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY organizer_payout_methods_insert_own ON public.organizer_payout_methods
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY organizer_payout_methods_update_own ON public.organizer_payout_methods
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY organizer_payout_methods_delete_own ON public.organizer_payout_methods
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY withdrawal_requests_select_own ON public.withdrawal_requests
  FOR SELECT TO authenticated USING (user_id = auth.uid());
