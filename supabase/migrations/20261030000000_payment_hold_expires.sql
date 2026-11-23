-- Unpaid online entries on online-only events release the slot after payment_hold_expires_at.

ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS payment_hold_expires_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS registrations_payment_hold_expires_idx
  ON public.registrations (payment_hold_expires_at)
  WHERE payment_hold_expires_at IS NOT NULL
    AND payment_status = 'pending'
    AND status <> 'cancelled';