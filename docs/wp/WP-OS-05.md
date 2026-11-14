---
id: WP-OS-05
title: Integración, E2E en DEMO e instalación por prompt
lane: sol
reviewers: [sonnet, gemini]
depends_on: [WP-OS-02, WP-OS-04]
size: M
milestone: M1
---

# WP-OS-05 — Integración, E2E en DEMO e instalación por prompt

## Goal

The screens and the engine work together in DEMO, proven by one Playwright happy path, and `INSTALL.md` is true: a coding agent following it on a clean machine reaches a passing DEMO smoke test without ever seeing a secret.

## Files it may touch

- `e2e/camino-feliz.spec.ts`, `e2e/apoyo/**`
- `scripts/doctor.mjs`, `scripts/smoke-demo.mjs`
- `convex/diagnostico.ts` (one internal-facing action used by `doctor`; see step 3)
- `package.json` (scripts `doctor`, `smoke:demo`), `package-lock.json` only if a script needs nothing new (it should not)
- `INSTALL.md`, `README.md`, `llms.txt`
- `tests/scripts/**`
- Small glue fixes in `app/**` or `components/**` that the E2E reveals — list each one in the PR

## Files it must not touch

`packages/engine/**`, `convex/motor/**`, `convex/schema.ts`, `CONTEXT.md`, `ARCHITECTURE.md`, `SECURITY.md`, `PLAN.md`, `docs/adr/**`, `docs/wp/**`. If the E2E reveals an engine bug, write the failing test, do not patch the engine: report it in the PR for `astra`.

## Steps

1. Rebase on `main` (or the stacked tips of WP-OS-02 and WP-OS-04). Run `npm run gate`. Fix only integration glue.
2. `e2e/camino-feliz.spec.ts` (DEMO, production build): open `/panel` → "Nuevo cobro" → concepto "Pedido de prueba", monto "450" → detail shows "Esperando pago" → read the payer URL from "Copiar link" → open it in a second page → it shows "$450.00" and "Esperando pago" → click "Simular pago" → payer page shows "Pago verificado" → the first page, without reload, shows "Liberado" and the three timeline steps → `/panel` shows the row as "Liberado". Assert the `DEMO` tag on every page. Seen failing first (run it before wiring, or break one selector on purpose and show the failure).
3. `npm run doctor` → `scripts/doctor.mjs`. Prints one line per variable of `.env.example` section B with `presente` / `falta` (for `PAYVRO_MODE` the value `demo`/`live`, for `PAYVRO_OWNER_EMAILS` the count) and, in LIVE, `cuenta en pey: ACTIVE | PENDING | PROCESSING | ERROR | no se pudo consultar`. It gets all of this by calling `convex/diagnostico.ts`, an action that returns booleans and enums only. The action is callable only with the deployment's admin auth (run through `npx convex run`), never from the browser. `doctor` exits 1 if something required for the current mode is missing.
   - It must be impossible for `doctor` to print a value: the action never returns one. Test it with sentinel values.
4. `npm run smoke:demo` → `scripts/smoke-demo.mjs`. Against the configured dev deployment in DEMO: create a cobro, simulate the payment, wait for `liberado`, read the bitácora, and print the seven `OK` lines listed in `INSTALL.md` §3. Refuses to run when the deployment is `live`. Exits non-zero on the first failed line and prints which.
5. Walk `INSTALL.md` from the top on a clean checkout, command by command, as the installing agent would. For every command or dashboard path that does not match reality, fix the document (not the reality, unless it is a real bug). Check against the current Convex, Clerk and Vercel docs: `npx convex dev --once`, creating a second project, `npx convex env set` (does it prompt when the value is omitted? does `--prod` exist?), the Clerk↔Convex integration name and where the issuer domain is shown, the Vercel build command. Remove the "Status of this document" note and the `[05]` markers only for steps you actually ran.
6. `README.md`: verify the local DEMO commands; keep the live-demo line as a placeholder until WP-OS-06. Add nothing that is not true today.
7. Tests, each seen failing first:
   - `tests/scripts/doctor.test.ts`: with a fake action result, output contains names and states, and none of the sentinel strings; missing required variable → exit code 1.
   - `tests/scripts/smoke.test.ts`: refuses on `live`.

## Done criterion

Observable
- On a machine with only Node 24 and a Convex login: `git clone`, then the commands of `INSTALL.md` §3 lead to `npm run smoke:demo` printing seven `OK` lines. Paste the transcript in the PR.
- `npm run doctor` in DEMO prints only names and states.
- The E2E passes three times in a row (`npx playwright test e2e/camino-feliz.spec.ts --repeat-each=3`).
- Every command left in `INSTALL.md` §§2–3 was executed by you; §§4–7 are marked as verified or as "not yet run" line by line in the PR.

Commands that must pass
```bash
npm run gate
npx playwright test e2e/camino-feliz.spec.ts --repeat-each=3
npm run doctor
npm run smoke:demo
```

## Out of scope

Deploying, creating Clerk or Vercel projects, any LIVE call, the $0.01 charge, new screens, engine changes.

## Risks

- Flaky E2E from reactive timing: wait on visible text with Playwright's auto-waiting, never on fixed sleeps.
- `doctor` is the tool an installing agent will run next to real secrets. Review it as security code: no value ever leaves Convex.
- CLI flags change. If a documented command cannot be verified, leave the dashboard path as the instruction and say so.
