---
id: WP-OS-10
title: "Endurecimiento: límites, CSP, auditoría de dependencias, redacción de logs"
lane: sol
reviewers: [opus, gemini]
depends_on: [WP-OS-05]
size: M
milestone: M2
---

# WP-OS-10 — Endurecimiento

## Goal

Close the gaps listed in `SECURITY.md` §9 that are not features: abuse limits on every public entry point, security headers, a dependency audit in the gate, and a proof that no secret reaches the client bundle or a log.

## Files it may touch

- `next.config.ts` (headers), `middleware.ts`
- `convex/motor/limites.ts` and the wrappers that call it
- `scripts/revisar-bundle.mjs`, `scripts/gate.sh`, `package.json` (scripts `audit`, `bundle:revisar`)
- `.github/workflows/gate.yml`
- `tests/seguridad/**`, `e2e/cabeceras.spec.ts`
- `SECURITY.md` (move items from "Known gaps" to controls, with the test that proves each)

## Files it must not touch

`packages/engine/src/verificacion.ts`, `packages/engine/src/estados.ts`, `convex/motor/verificar.ts`.

## Steps

1. Headers on every response: `Content-Security-Policy` (default-src 'self'; connect-src the Convex and Clerk origins; img-src 'self' data:; frame-ancestors 'none'; no `unsafe-eval`; nonce or hash for inline scripts Next.js needs), `Referrer-Policy: no-referrer` on `/pagar/**` (the URL is a capability), `X-Content-Type-Options`, `Permissions-Policy` minimal, `Cache-Control: no-store` on `/pagar/**` and `/panel/**`.
2. Limits (fixed window, per key): `publico.cobro` and `publico.vigilar` per `publicId` and per deployment; `cobros.crear` per owner; `/webhooks/pey` and `/volver` per deployment; DEMO writes per deployment. Exceeding → `DEMASIADAS_SOLICITUDES` / HTTP 429 with `Retry-After`.
3. `npm run audit`: `npm audit --omit=dev --audit-level=high` in the gate; a finding fails the gate unless listed with a reason and an expiry date in `docs/auditoria-excepciones.md`.
4. `scripts/revisar-bundle.mjs`: after `next build`, scan `.next/static/**` for the names `PEY_API_KEY`, `PEY_WEBHOOK_SECRET`, `CLERK_SECRET_KEY`, `CONVEX_DEPLOY_KEY` and for a sentinel value injected at build time in the test; any hit fails. (A name count is not proof of safety; the sentinel value is the real check.)
5. Log redaction: one `registroSeguro()` helper for any server log; it accepts only enumerated fields. Test with sentinel secrets flowing through a failing pey call, a failing webhook and a thrown error: none appears in captured logs or in the bitácora.
6. `publico.cobro` uniformity: unknown id, malformed id and another deployment's id return the same value in the same shape; test it.
7. Tests, each seen failing first: header presence per route (Playwright); a burst over each limit; the bundle scan catching a deliberately leaked sentinel; redaction; uniformity.

## Done criterion

Commands that must pass
```bash
npm run gate          # now includes audit and bundle:revisar
npx playwright test e2e/cabeceras.spec.ts
```

`SECURITY.md` §9 no longer lists CSP, dependency audit or abuse limits as gaps, and each moved item names its test.

## Out of scope

WAF, bot detection, penetration test, privacy notice text (M3, needs the founders), Cloud's tenant isolation.

## Risks

- A strict CSP can break Clerk or Next.js hydration. Verify sign-in and the payer page in a real browser after the change, in a production build.
- Limits that are too tight break the sondeo heartbeat (every 10 s per open page). Size them from that number.
