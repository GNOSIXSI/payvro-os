# WP-OS-02 result — consolidated HEAD

## Status

**Incomplete; not ready for `OPERATOR_VERIFY` as a completed WP.** The session implemented the portable engine foundations and schema definitions, but did not implement the Convex motor, authorization/ports, public wrappers, cron jobs, lifecycle, or end-to-end DEMO flow. Do not treat the passing repository gate as evidence that the WP acceptance criteria are met. No push was made.

## Commits

- `daf921b3e9d783bd248df0d44a3ea37540bfb88e` — `feat: add PAYVRO engine policy and simulator foundations`
- Result-report commit: recorded by final HEAD after this file is committed.

## What changed and why

- Added explicit cobro and intento transition maps and transition functions.
- Added pey boundary/result types and an injected-store simulator with exact, mismatched, duplicate, and card variants.
- Added pure payment evidence evaluation, including base-vs-total checks, fees, tips, payment method, partial links, payable match, duplicate transaction, and QR destination signal.
- Added motor table definitions and composed them into the Convex schema.
- Added unit coverage for state transitions, verification policy, and simulator shapes/variants.

## Test authoring gate

For the new tests:

- **Observable behavior:** legal/illegal lifecycle transitions, payment verification outcomes, and the simulator's pey-shaped payment representations.
- **Credible regressions:** allowing illegal state jumps; comparing total rather than base; accepting over/underpayment, CARD, tip, partial or duplicate evidence; returning simulator data with incorrect payment fields or variant counts.
- **Why existing tests did not catch these:** baseline coverage only exercised ids, money, and lint boundaries; it had no state, verification, or simulator tests.
- **Test-only seam:** no production-only test export was added. The simulator receives the same store interface its production adapter must implement.

## Tests and mutation evidence

- First simulator run failed on `MONTO_INVALIDO` for a legitimate zero pey fee; adjusted the breakdown conversion to permit zero while keeping charge amounts positive. Then the targeted tests passed.
- Verification mutation: changed the production comparison `base === esperado.montoCentavos` to `base >= esperado.montoCentavos`. The initial suite did not kill this mutant. Added an overpayment case; with the mutant active, `npm test -- tests/verificacion.test.ts` failed at `rejects a base above the expected amount` because it returned `coincide` instead of `monto_distinto`. Restored `===`; full verification test passes.
- `npm test -- tests/simulador.test.ts tests/estados.test.ts tests/verificacion.test.ts` — passed, 25 tests at that point. The later overpayment case is included in the passing full suite.
- `npm run typecheck` — passed after final changes.
- `npm run lint` — passed (the gate's final lint had no warnings).
- `npm test` — passed, 43 tests across 6 files.
- `npm run build` — passed.
- `npm run gate` — exit 0. Included typecheck, lint, all 43 tests, build, E2E smoke (1 passed), and gitleaks (no leaks).
- `grep -rn "NO_IMPLEMENTADO" convex packages | wc -l` — printed **6**, not the required 1.
- `git diff --check` — passed before commit.

## Acceptance gaps / evidence not produced

- No `convex/motor/{puertos,cobros,intentos,verificar,liberar,bitacora,peyPuerto,limites}.ts` implementation was completed (only `tablas.ts` exists).
- `convex/{negocio,cobros,panel,publico,demo}.ts` remain WP-OS-01 stubs. `convex/_stub/` remains.
- No append-only write path, idempotent creation, call-before-PEY ordering, unknown-outcome scheduling, evidence application, global transaction claim, auth/tenant isolation, rate limiter, expiry/purge cron, or public-function authority tests were implemented.
- The simulator is not wired to Convex persistence; no full DEMO flow or zero-fetch Convex assertion was exercised.
- No Convex dev deployment/run was used. The WP's `cobros.crear → demo.simularPago → panel.bitacora` observable criterion is **not verified**.
- The implementation does not satisfy the WP command-level grep criterion (`NO_IMPLEMENTADO` count is 6).

## Decisions taken

- Preserved the frozen public wrapper signatures and avoided editing files outside the WP boundary.
- Allowed zero for pey fee/tip breakdown values because the pey shape can validly represent no fee/tip; kept the existing positive cobro amount validation untouched.
- No product decision was needed.

## Doubts for orchestrator

- The schema stores `bitacora.detalle` as `v.any()` for now; the required per-event detail validation must be implemented in the registrar before this is considered safe.
- The requested WP is not complete. The remaining Convex/backend work and its behavior-focused tests need a follow-up builder session before review/ship.
