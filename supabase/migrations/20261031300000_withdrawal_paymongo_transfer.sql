ALTER TABLE public.withdrawal_requests
  ADD COLUMN IF NOT EXISTS paymongo_transfer_id TEXT;