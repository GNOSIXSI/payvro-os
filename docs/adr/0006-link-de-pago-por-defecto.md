# ADR-0006 — Payment link by default; CoDi QR only for fixed-price counter tags

- Status: Accepted (locked by the founders, 2026-11-14)

## Context

Facts (pey OpenAPI snapshot, 2026-11-14, and pey in person on 2026-11-07)
- Three ways to charge: payment link, CoDi QR, CoDi push to a phone.
- A payment link takes one payment. A CoDi QR can be paid several times. Neither can be cancelled.
- `POST /codi/qr` accepts `amount: 0`, which lets the payer type any amount.
- `POST /payment-link/create` requires HTTPS `successUrl` and `backUrl`, accepts `clientReferenceId` and `metadata`, and has no `bankAccountId`, no expiration and no payment-method filter. The example response lists `CODI` and `CARD` as methods.
- `POST /codi/qr` accepts `bankAccountId`, `expiration` (minimum 360 s when set) and `numRef`.
- pey has no idempotency key on any create call.

## Decision

1. An order ("Pedido que se libera"), an appointment deposit and a quote are charged with a **payment link**, one active intento per cobro.
2. A **CoDi QR** is used only for the Mostrador template: a fixed-price tag that is meant to be paid many times, each payment becoming its own cobro.
3. PAYVRO never creates a QR with amount 0. `montoCentavos ≥ 1` is validated before the adapter and again inside it.
4. Links are created with `hasTip: false`. A transaction with a tip, or paid by a method other than CoDi, does not release automatically (`en_revision`).
5. "Mostrar QR" on an order renders a QR of the payment link URL (opens the pey page on the phone), labeled as such, not a CoDi QR.

## Consequences

- The common double-payment case (customer taps twice, or pays an old QR again) cannot happen with a link.
- The payer goes through pey's hosted page; PAYVRO's payer page is the wrapper that shows the business, the amount and the verified state.
- Because a link cannot be cancelled, an old intento may still be paid after a new one exists. Verification accepts a payment on any intento of the cobro and flags a second one as `pago_duplicado`.
- Because a link has no `bankAccountId`, the money goes to the account linked to the API key. In OS that is the business's own account, by ADR-0003. In Cloud it constrains the "platform key" mode (see the Cloud ADRs).
- Card payments through a link are possible and are held for review. Whether a link can be limited to CoDi is an open question for pey.

## Open

The approved prototype shows a QR with "Paga con la app de tu banco (CoDi)" on the order's payer page. That reads as a CoDi-native QR, which this decision reserves for Mostrador. The founders choose; until then, point 5 stands.
