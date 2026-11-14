# ADR-0006 — Native CoDi QR by default for orders

- Status: Accepted (supersedes the original decision, founder decision 2026-11-14)

## Context

Facts (pey OpenAPI snapshot, 2026-11-14, and notes attributed to pey, 2026-11-07)
- Three ways to charge: payment link, CoDi QR, CoDi push to a phone.
- A payment link takes one payment. A CoDi QR can be paid several times. Neither can be cancelled.
- `POST /codi/qr` accepts `amount: 0`, which lets the payer type any amount.
- `POST /payment-link/create` requires HTTPS `successUrl` and `backUrl`, accepts `clientReferenceId` and `metadata`, and has no `bankAccountId`, no expiration and no payment-method filter. The example response lists `CODI` and `CARD` as methods.
- `POST /codi/qr` accepts `bankAccountId`, `expiration` (minimum 360 s when set) and `numRef`.
- pey has no idempotency key on any create call.

## Decision

1. An order ("Pedido que se libera") uses a **native CoDi QR** by default. It has one fixed amount and expires after 24 hours.
2. A **CoDi push** to the payer's phone may accompany the QR. It is a payment prompt, never evidence that the payment completed.
3. **Pagar con link** is the fallback. Because pey cannot cancel a QR and one cobro has at most one active intento, the fallback is offered only after the QR intento is terminal or expired; the old payable is still checked for late payment.
4. A second distinct payment received for an order QR is held in `en_revision` and is not released automatically. If the first payment already released the order, the original cobro remains `liberado` with `alerta: pago_duplicado`; it is never reopened.
5. PAYVRO never creates a QR with amount 0. `montoCentavos ≥ 1` is validated before the adapter and again inside it.
6. Links are created with `hasTip: false`. A transaction with a tip, or paid by a method other than CoDi, does not release automatically (`en_revision`).

## Consequences

- An order presents CoDi directly in the payer's banking app. A link remains available as a fallback, but it may allow CARD, which is held for review.
- A QR can accept multiple payments. The first matching payment may complete the order; any additional distinct payment is recorded as a duplicate and held in `en_revision`, never released automatically. If the order was already released, its cobro remains `liberado` with `alerta: pago_duplicado`.
- Because pey cannot cancel a QR, an expired or replaced intento may still produce a late payment. Verification checks every intento of the cobro and routes a late or duplicate payment to review.
- Because a link has no `bankAccountId`, the money goes to the account linked to the API key. In OS that is the business's own account, by ADR-0003. In Cloud it constrains the "platform key" mode (see the Cloud ADRs).
- Card payments through a link are possible and are held for review. Whether a link can be limited to CoDi is an open question for pey.
