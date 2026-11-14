# ADR-0007 — Local mode works by polling; the webhook is optional everywhere

- Status: Accepted (locked by the founders, 2026-11-14; mechanism designed here)

## Context

Facts
- OS must also run on the owner's computer, installed by their agent.
- A Next.js app on `localhost` has no public URL: the payer's phone cannot open it and pey cannot call it.
- pey requires `successUrl` and `backUrl` to be HTTPS when creating a payment link.
- A Convex cloud deployment (including the dev deployment that `npx convex dev` creates) serves HTTP actions at a public `https://<deployment>.convex.site` address, and runs crons and scheduled functions whether or not the developer's machine is on.
- pey sends webhooks once and never retries, so no install may depend on them (ADR-0004).

## Decision

1. **Truth by polling.** In every shape, a payment is found by the sondeo (1–2 s while the charge is on screen) and the cron sweep (every minute). Local mode adds nothing and removes nothing from that.
2. **Return URLs always point to Convex.** `successUrl` and `backUrl` are `https://<deployment>.convex.site/volver?c=cob_…`. That HTTP action redirects to `${PAYVRO_PUBLIC_URL}/pagar/cob_…` when the install has a public app, and otherwise renders a one-paragraph page ("Estamos verificando tu pago; ya puedes cerrar esta página"). This satisfies pey's HTTPS rule without a public app.
3. **In local mode the owner shares pey's link.** The panel offers "Copiar link de pey" and a QR of it. The PAYVRO payer page is for installs with a public URL.
4. **The webhook is optional and independent of the app's shape.** Its endpoint is the Convex HTTP action, which is public even when Next.js is local. Without `PEY_WEBHOOK_SECRET` it answers 503.
5. **Fully offline Convex is not supported for LIVE.** Without an HTTPS address there are no return URLs, so no links. DEMO works offline.

## Consequences

- "Local" means "the UI is local". State, schedule and verification still run in the owner's Convex deployment, which is what keeps a closed laptop from losing a payment.
- Local mode has no branded payer page. The customer sees pey's page and a plain return page.
- `/volver` is one more public endpoint. It is read-only navigation, records an `evento` of origin `retorno`, and can only redirect to the configured origin.
- An install can move from local to Vercel by setting `PAYVRO_PUBLIC_URL`; nothing else changes.
