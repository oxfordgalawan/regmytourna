# Payments — RegMyTourna

## Active rail: PayMongo

Until the StarPago merchant API is approved and wired in the product:

- **Online registration:** PayMongo hosted checkout (`checkout.session.payment.paid` webhook).
- **Desk / walk-in QR:** PayMongo checkout URL encoded as a QR in the organizer app ([`CollectPaymentDialog`](../src/components/organizer/walk-in-dialogs.tsx)).

Configure keys and webhooks per [README](../README.md) (PayMongo section).

## Desk QR Ph — player compatibility

When an organizer uses **Show QR**, the app displays a notice ([`qrph-desk-copy.ts`](../src/lib/payments/qrph-desk-copy.ts)):

- **Does not work in GCash.**
- Works with **Maya**, **GoTyme**, **Maribank**, and other **bank / InstaPay QR Ph** apps.

Online PayMongo checkout may still offer GCash on PayMongo’s hosted page; the desk QR disclaimer applies only to the in-app QR flow.

## Withdrawals

Organizer wallet withdrawals are **ledger + manual payout**: organizers request from `/organizer/wallet`; super admins approve at `/super-admin/withdrawals` and transfer outside the app. No PayMongo Payout API in v1.

## StarPago (deferred)

Relay, callbacks, and env are documented for merchant onboarding only. **Live registration payments do not use StarPago** until credentials and channels are enabled in the app.

See [STARPAGO_PRODUCTION.md](./STARPAGO_PRODUCTION.md) and [STARPAGO_MERCHANT_REGISTRATION.md](./STARPAGO_MERCHANT_REGISTRATION.md).
