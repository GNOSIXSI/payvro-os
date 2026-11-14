# ADR-0001 — Stack: Next.js on Vercel, Clerk, Convex, pey API

- Status: Accepted (locked by the founders, 2026-11-14)
- Scope: PAYVRO OS and PAYVRO Cloud

## Context

Facts
- The hackathon requires CoDi through the pey API, a public repo and, preferably, a live app by Sun 2026-11-15 13:00 CDMX. About 24 hours from this decision.
- pey delivers webhooks once, without retries, and has no idempotency, no cancel and no expiry event. So the app needs durable state, scheduled work and a place to receive HTTP.
- Convex gives transactional mutations, scheduled functions, crons, HTTP actions and reactive queries in one deployment. Clerk and Convex have an official integration. Clerk and Convex both document Next.js.
- The team's earlier private bootstrap of the pey integration was written on Next.js.
- PAYVRO never holds money. The truth of a payment is always in pey.

Inference
- Builder agents write Next.js with fewer API mistakes than younger frameworks, because there are more public examples.
- With this scope, Convex's serializable mutations are enough to keep a state machine and an append-only log consistent. A relational ledger would matter if PAYVRO held balances; it does not.

## Decision

- App: Next.js (App Router, TypeScript strict) on Vercel, or `next dev` locally.
- UI: Tailwind CSS + shadcn/ui (Radix).
- Identity: Clerk. In Cloud each business is a Clerk organization.
- Backend: Convex — data, state machine, append-only bitácora, HTTP action for the pey webhook, cron sweep.
- Payments: pey API.
- Tests: Vitest, convex-test, Playwright.
- No Postgres and no Rust in M1. No AI model on the payment path.

## Consequences

- One backend deployment per install; nothing to operate besides Vercel, Convex and Clerk.
- Network calls cannot run inside Convex mutations, which forces the pattern "mutation reserves → action calls pey → mutation applies". That pattern is exactly what record-before-call needs (ADR-0010).
- The engine must not depend on Convex to stay portable: pure logic lives in `packages/engine`, the Convex layer in `convex/motor` (ADR-0008).
- Known build trap: `next build` with Turbopack failed with symlinked `node_modules` (seen 2026-11-07). Use `npm ci` in every worktree.

## Revisit when

A measured need appears that TypeScript on Convex cannot meet (the founders left a Rust reconciliation service open for M2–M3 under that condition). Write a new ADR; do not edit this one.
