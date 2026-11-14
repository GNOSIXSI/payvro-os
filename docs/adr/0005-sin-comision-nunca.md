# ADR-0005 — No commission, ever; PAYVRO never touches the money

- Status: Accepted (locked by the founders, 2026-11-14)

## Context

Facts
- The founders' rule: PAYVRO never touches funds, never charges a commission or a per-payment fee, and its price never scales with the number of payments.
- Each business charges into its own CLABE. No pooled accounts.
- The founders read that charging a commission on CoDi is prohibited, and that pey's terms describe its own future charges as software fees, not a percentage. No legal opinion has been obtained.
- The pey API returns `amountBreakdown.fee` and `applicationFee` on transactions (card payments through a link carry a fee to the payer).

## Decision

In this codebase:

1. No function computes, adds, withholds, displays as PAYVRO's, or stores a fee, commission or percentage on a payment.
2. No limit, quota, plan check or price depends on the number or the amount of payments. Limits may depend on features, users, templates or branches (Cloud).
3. PAYVRO creates charges that pay into the business's own account and reads their status. It never creates a payable for an account that is not the business's, and it has no code for payouts, refunds, splits or balances.
4. The fee fields pey returns are recorded as read (`feeCentavos`) for the business's own reconciliation and are never attributed to PAYVRO. Verification compares the cobro against the transaction **base**.
5. User copy says it plainly: "Sin comisión. Ni por pago, ni porcentaje, nunca."

A test enforces 1–2 in OS: the engine and Convex sources contain no arithmetic on a payment that produces a fee, and no branch on a payment count.

## Consequences

- The business model is a fixed subscription for software, in Cloud. OS is free.
- PAYVRO is not a payment institution in this design: it holds no funds. (Inference, not a legal opinion; a lawyer reviews before Cloud charges anyone.)
- Features that would need funds to pass through PAYVRO (marketplace splits, escrow, refunds) are out of the product until a new ADR and legal review say otherwise.
- "Unlimited payments on the free plan" is a consequence, not a promotion: there is nothing to meter.
