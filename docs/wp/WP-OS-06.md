---
id: WP-OS-06
title: Despliegue DEMO + LIVE y cobro real de $0.01
lane: sol
reviewers: [opus]
depends_on: [WP-OS-03, WP-OS-05]
size: M
milestone: M1
---

# WP-OS-06 — Despliegue DEMO + LIVE y cobro real de $0.01

## Goal

A public DEMO URL for the submission form, and one real $0.01 CoDi charge on an event test account that PAYVRO verified against pey and released, with evidence that contains no secret and no personal data.

This package creates cloud resources and moves real money (one centavo). **A person does the gated steps.** The builder prepares, checks and documents; the founder clicks, pastes secrets and pays.

## Files it may touch

- `app/entrar/[[...rest]]/page.tsx`, `middleware.ts` (Clerk sign-in route and route protection for `/panel` in LIVE only)
- `vercel.json` (only if the build command cannot be set in the dashboard)
- `README.md` (live DEMO link), `INSTALL.md` (corrections found while deploying)
- `docs/despliegue.md` (runbook: what was created, by name, no values)
- `docs/evidencia/2026-11-15-cobro-centavo.md` (redacted evidence)
- `packages/engine/src/pey/esquemas.ts` and `tests/pey/formas/*.json` only to correct a shape that the real pey response contradicted (redacted; see step 7)
- `CONTEXT.md` §6 to record tagged pey facts learned

## Files it must not touch

`convex/motor/**` (report bugs; `astra` fixes them), `packages/engine/src/verificacion.ts`, `packages/engine/src/estados.ts`, `ARCHITECTURE.md`, `SECURITY.md`, `PLAN.md`, `docs/adr/**`.

## Steps

Builder, before the founder is needed
1. `app/entrar` with Clerk's sign-in component; `middleware.ts` protects `/panel/**` only when the Clerk publishable key is present. `/pagar/**`, `/` and DEMO stay public. The authorization that matters is still inside every Convex function (`resolverNegocio`); the middleware is convenience.
2. Test, seen failing first: with Clerk configured and a signed-in identity whose email is not in `PAYVRO_OWNER_EMAILS`, every `cobros.*`, `panel.*`, `negocio.*` function called directly returns `NO_AUTORIZADO` (convex-test with a fake identity).
3. Write `docs/despliegue.md`: the two deployments, each variable by **name** and where it lives, the order of operations below, and how to roll back (redeploy the previous Vercel build; Convex functions redeploy from the same commit).

Founder (each line is one explicit OK; the builder does not do these)
4. **DEMO deployment.** Create Convex project `payvro-os-demo` and a Vercel project from `main`. Set `PAYVRO_MODE=demo`. No Clerk, no pey variables. Build command `npx convex deploy --cmd 'npm run build'` with `CONVEX_DEPLOY_KEY` in Vercel.
5. **LIVE deployment.** A second Convex project and Vercel project (`payvro-os-live`). Clerk application with sign-ups restricted. In the Convex dashboard: `PAYVRO_MODE=live`, `CLERK_JWT_ISSUER_DOMAIN`, `PAYVRO_OWNER_EMAILS`, `PEY_API_KEY`, `PEY_BANK_ACCOUNT_ID` (event test account), then `PAYVRO_PUBLIC_URL`. Secrets are typed by the founder into dashboards.

Builder, with the founder present
6. Verify both: DEMO URL passes the checklist of `INSTALL.md` §3 by hand; `npm run doctor` against LIVE shows everything `presente` and `cuenta en pey: ACTIVE`; a sign-in outside the owner list is refused.
7. **The charge** (founder says "sí" for this one charge): create a cobro of `0.01`, concept `Prueba PAYVRO`. Founder pays from a test account with CoDi. Record the wall-clock times of: created, paid in the bank app, "Pago verificado", "Liberado".
   - If pey's real responses fail schema validation (cobro stays `esperando_pago`, bitácora shows `forma_inesperada`): do not force anything. Capture the response **shape** (field names and types, values replaced: ids → `01XXXXXXXXXXXXXXXXXXXXXXXX`, CLABE → `000000000000000000`, names → removed), fix `esquemas.ts` and the recorded shape with a failing test first, redeploy, and let the sweep pick the payment up. The same payment must then verify without a second charge.
8. `docs/evidencia/2026-11-15-cobro-centavo.md`: the four times, the bitácora entry types in order with their `seq`, the pey `requestId`s, and the latency from "paid" to "liberado". No screenshot of a bank app, no account number, no holder name, no email, no key, no full pey transaction id (first 6 and last 4 characters only).
9. README: replace the placeholder with the DEMO URL. `PLAN.md`'s exit checklist is ticked by the founder, not here.
10. Final hygiene on `main` before the form is sent: `npm run secrets`, then `git log -p --all | grep -nE '[0-9]{18}'` reviewed by eye (every 18-digit hit must be the fixture `000000000000000000`).

## Done criterion

Observable
- The DEMO URL is open to anyone and a stranger completes create → simulate → "Liberado".
- The LIVE URL shows no `DEMO` tag, refuses a non-owner, and has one cobro of $0.01 in state `liberado` whose bitácora shows `cobro.creado → intento.reservado → pey.llamada → intento.creado → pago.verificado → cobro.liberado`.
- The evidence file exists and passes the redaction rules of step 8.
- The live link in README resolves.

Commands that must pass
```bash
npm run gate
npm run doctor                                   # against LIVE: all presente, cuenta ACTIVE
npm run secrets
git log -p --all | grep -cE '[0-9]{18}'          # every hit accounted for as the fixture
curl -s -o /dev/null -w '%{http_code}\n' https://<demo-url>/           # 200
curl -s -o /dev/null -w '%{http_code}\n' https://<live-url>/panel      # redirects to sign-in (307/302) or 200 with the sign-in screen
```

If the charge cannot be completed before Sunday 11:00 CDMX, stop trying on Vercel, run LIVE locally per ADR-0007, record it, and say so plainly in the evidence file.

## Out of scope

Custom domain, webhook registration, analytics, a real business's account, any charge above $0.01, a second charge "to be sure" without a new OK.

## Risks

- Creating projects on Vercel/Convex/Clerk may touch paid plans: the founder decides at each prompt.
- A secret pasted in the wrong field (a `NEXT_PUBLIC_` variable, a chat) is exposed: rotate it at the provider, do not just delete it.
- Event test accounts may have limits or quirks nobody documented. Record what you observe as `[FACT]` with the date in `CONTEXT.md` §6.
- Vercel deploys only what is on `main`. What merges is what ships: do not merge anything on Sunday morning that has not passed the gate.
- Opening the LIVE panel to the wrong audience: verify the refusal with a second account before sharing any URL.
