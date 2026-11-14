# ADR-0004 — The truth of a payment is an authenticated GET to pey

- Status: Accepted (locked by the founders, 2026-11-14)

## Context

Facts
- pey sends each webhook once and does not retry (told by pey in person, 2026-11-07).
- pey webhooks are signed following Standard Webhooks (same source). The OpenAPI snapshot of 2026-11-14 does not describe webhooks at all.
- pey has no expiry or cancel event.
- `GET /payment-link/{id}` and `GET /transaction/{id}` return status, amounts with breakdown, payable type and id, and only for the API key that owns them.
- A valid signature proves that whoever holds the webhook secret sent the message. It does not prove the money moved, and it says nothing if the secret leaked.

## Decision

1. A cobro becomes `pagado_verificado` only after PAYVRO's server reads pey with the business's API key and the pure policy (`verificacion.ts`) returns `coincide`: payable, base amount in centavos, currency, method and destination all match.
2. The webhook is a doorbell (**timbre**). After its signature is verified it is stored as an `evento` and triggers the same GET. Its amount and status fields are never read as truth.
3. Three independent triggers lead to that GET, so no single one is required:
   - **sondeo**: every 1–2 s while someone has the charge on screen;
   - **timbre**: the webhook, when configured;
   - **barrido**: a cron sweep over active intentos and over pey's transaction listing.
4. Mismatch → `en_revision`. Never released automatically.
5. Return URLs (`successUrl`) are navigation. They trigger a verification and prove nothing.

## Consequences

- A lost webhook costs seconds, not a sale. A forged webhook costs one GET.
- Local installs without a public app URL work with polling and the sweep alone (ADR-0007).
- More calls to pey than a webhook-only design. pey's rate limits are unknown; the sondeo backs off on 429/5xx and stops when nobody is watching.
- Release latency is bounded by the polling interval while watched and by the sweep interval (1 minute) otherwise.
- Every path funnels into one mutation, `aplicarEvidencia`, which is idempotent. That is the only place to audit.

## Rejected

- Trusting the signed webhook payload: one lost event would leave a paid order unreleased forever, and a leaked secret would release unpaid orders.
- Letting the browser report success: the browser belongs to the payer.
