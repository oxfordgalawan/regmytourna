-- Partner invites: partners can accept (link their account) or say "not me".
-- The entry itself doesn't depend on this — it counts once paid.

ALTER TABLE public.registration_players
  ADD COLUMN IF NOT EXISTS partner_responded_at TIMESTAMPTZ;

-- auto-match invites to accounts by email at signup / login
CREATE INDEX IF NOT EXISTS registration_players_guest_email_lower_idx
  ON public.registration_players (lower(guest_email))
  WHERE guest_email IS NOT NULL;

-- entries left in "awaiting_partner" by the old flow follow their payment state instead
UPDATE public.registrations
SET status = CASE WHEN payment_status = 'paid' THEN 'confirmed'::public.registration_status
                  ELSE 'awaiting_payment'::public.registration_status END
WHERE status = 'awaiting_partner';
