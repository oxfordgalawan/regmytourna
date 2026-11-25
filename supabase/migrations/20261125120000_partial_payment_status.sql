-- Partial payment when entry fee was corrected after an initial payment.

ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'partial';

ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS fee_adjustment_notified_at TIMESTAMPTZ;

COMMENT ON COLUMN public.registrations.fee_adjustment_notified_at IS
  'When the organizer sent a fee-correction / balance-due notice for this entry.';