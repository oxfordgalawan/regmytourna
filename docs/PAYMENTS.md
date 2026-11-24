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

## Organizer wallet & convenience fee

- Default **convenience fee** is `PLATFORM_FEE_PERCENT` (env, usually 5%). Applied to **online / desk QR** entry payments when crediting the organizer wallet (`gross − fee`).
- **Cash at the desk:** money stays with the organizer; the convenience fee is debited from the wallet via `charge_cash_platform_fee` (balance may go negative until online income offsets it).
- **Per-organizer overrides** on `profiles`:
  - `platform_fee_percent` — `NULL` uses the global default; set `0` for no RegMyTourna convenience fee.
  - `wallet_credit_settlement` — when `true`, online/QR credits use **PayMongo settlement** (net after PayMongo’s MDR), not the player’s full entry amount. Shown in wallet activity as **settlement** vs **gross**.
- Example: player pays **₱1,000**, PayMongo settles **₱985.05**, Neil-style account (0% + settlement) credits **₱985.05** to the ledger so withdrawals stay aligned with PayMongo cash.

Super admins see overrides on `/super-admin/organizers` (read-only).

## Withdrawals

Organizers request from `/organizer/wallet`; super admins approve at `/super-admin/withdrawals`. When PayMongo wallet env is set, approval can InstaPay from the merchant wallet; otherwise mark paid manually.

## StarPago (deferred)

Relay, callbacks, and env are documented for merchant onboarding only. **Live registration payments do not use StarPago** until credentials and channels are enabled in the app.

See [STARPAGO_PRODUCTION.md](./STARPAGO_PRODUCTION.md) and [STARPAGO_MERCHANT_REGISTRATION.md](./STARPAGO_MERCHANT_REGISTRATION.md).
