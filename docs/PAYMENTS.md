# Payments — RegMyTourna

## Active rail: PayMongo

Until the StarPago merchant API is approved and wired in the product:

- **Online registration (in-drawer Pay QR):** PayMongo **QR Ph** payment intent (`qrph` attach → `paymongo_qr_image_url`; webhooks `payment_intent.succeeded` and `checkout.session.payment.paid`).
- **Desk / walk-in QR:** Same QR Ph image in [`CollectPaymentDialog`](../src/components/organizer/walk-in-dialogs.tsx) — not a checkout URL encoded as QR.
- **Browser fallback:** Optional PayMongo hosted checkout (`checkoutUrl`) for card / GCash via **Open checkout in browser** in [`CheckoutQrPanel`](../src/components/payments/checkout-qr-panel.tsx).

Configure keys and webhooks per [README](../README.md) (PayMongo section).

## Desk QR Ph — player compatibility

When an organizer uses **Show QR**, the app displays a notice ([`qrph-desk-copy.ts`](../src/lib/payments/qrph-desk-copy.ts)):

- **Does not work in GCash.**
- Works with **Maya**, **GoTyme**, **Maribank**, and other **bank / InstaPay QR Ph** apps.

Online PayMongo checkout may still offer GCash on PayMongo’s hosted page; the in-app QR is **QR Ph** (bank / Maya apps).

**PayMongo dashboard:** Subscribe the webhook to `payment_intent.succeeded` (and keep `checkout.session.payment.paid` for browser checkout). Enable **QR Ph** on the merchant account.

## Withdrawals

Organizer wallet withdrawals are **ledger + manual payout**: organizers request from `/organizer/wallet`; super admins approve at `/super-admin/withdrawals` and transfer outside the app. No PayMongo Payout API in v1.

## StarPago (deferred)

Relay, callbacks, and env are documented for merchant onboarding only. **Live registration payments do not use StarPago** until credentials and channels are enabled in the app.

See [STARPAGO_PRODUCTION.md](./STARPAGO_PRODUCTION.md) and [STARPAGO_MERCHANT_REGISTRATION.md](./STARPAGO_MERCHANT_REGISTRATION.md).
