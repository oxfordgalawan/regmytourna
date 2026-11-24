ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS paymongo_qr_image_url TEXT NULL,
  ADD COLUMN IF NOT EXISTS qr_expires_at TIMESTAMPTZ NULL;