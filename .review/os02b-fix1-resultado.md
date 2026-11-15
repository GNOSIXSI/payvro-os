# os02b-fix1 — partial-link evidence filtering

## Status

**Fix implemented and local acceptance met.** Partial-link evidence now persists and claims only paid transactions matching the intended payable. Pending rows without `datePaid` and rows for another payable are ignored. A later PAID observation of a formerly pending transaction is recorded without reopening or releasing the already-reviewed cobro.

No push, deployment, LIVE request, or charge occurred. This report is a builder self-assessment, not an independent review or merge approval.

## Commits

- `9077182` — `fix: filter partial-link payment evidence`
- Base before this fix: `ad75966` (`feat/os02b-motor` HEAD). The branch already contained the preceding os02b work; no history was rewritten.
- This report is committed separately after the implementation.

## Changed files and behavior

- `packages/engine/src/verificacion.ts`: calculate the existing trusted payable-matching PAID set before handling `partial`; `revisar/parcial` returns that set instead of every transaction from the link.
- `convex/motor/verificar.ts`: later newly-paid transactions from the same cobro already in `en_revision/parcial` are persisted with result `parcial` and logged as `pago.no_coincide`. The cobro remains in review; there is no release or state transition.
- `tests/verificacion.test.ts`: policy-level partial case includes a PAID payable transaction, a PENDING transaction with no `datePaid`, and a PAID transaction for another payable; only the first is returned.
- `tests/motor/demo-flow.test.ts`: caller-boundary convex-test proves partial evidence does not throw, exactly one pago is stored initially, the cobro enters `en_revision/parcial`, neither excluded transaction is claimed, and the formerly pending id is recorded when later supplied as PAID.

Exact amount comparison, destination proof, and the global transaction claim guard were not changed. No generated files, schema, or files outside the requested scope were changed.

## Red-first and mutation evidence

- Before the fix, `npm test -- --run tests/verificacion.test.ts tests/motor/demo-flow.test.ts` failed both new tests (2 failed / 15 passed). The policy returned PENDING and non-matching rows for `parcial`; the real Convex caller attempted to persist the pending row and threw `TRANSICION_INVALIDA` because it had no valid `datePaid`.
- After the policy filter was added, the caller test's later-PAID assertion still failed with `TRANSICION_INVALIDA` (“El cobro no admite aplicar esta evidencia.”). This exposed that the newly observed PAID id, although no longer claimed while pending, could not be recorded once the cobro was already under review. The bounded append-only evidence path above fixed that without changing the cobro state.
- Mutation check: changed the partial verdict to return `evidencia.transacciones` rather than the filtered set, then reran the two focused test files. Both went red: the policy assertion showed the extra PENDING and other-payable rows; the Convex caller again threw `TRANSICION_INVALIDA` for the PENDING row without `datePaid`. Restored the filter and reran: **2 files, 17 tests passed**.
- The caller test verifies the transaction-id claim behavior through `aplicarEvidencia`, not only the pure policy. Successful persistence of the newly PAID id would fail if it had been claimed while pending (the apply would return `repetido` and the second pago would be absent).

## Gates

All commands used Node `v24.22.2`. Exit status shown is the actual command status.

| Command | Exit | Tail / evidence |
|---|---:|---|
| `npm run typecheck` | 0 | `tsc --noEmit` passed for app, engine, and Convex projects. |
| `npm run lint` | 0 | `eslint .` completed cleanly. |
| `npm test` | 0 | `Test Files 7 passed (7)` · `Tests 55 passed (55)`. |
| `npm run build` | 0 | Next production build compiled, TypeScript passed, static pages generated. |
| `npm run gate` | 0 | Typecheck/lint/tests/build passed; Playwright: `1 passed (2.1s)`; gitleaks working tree and history: `no leaks found`. |
| `git diff --check` | 0 | No whitespace errors. |

Full-gate output tail:

```text
Test Files  7 passed (7)
     Tests  55 passed (55)
...
✓  1 e2e/humo.spec.ts:3:1 › home presents PAYVRO and the DEMO mode
1 passed (2.1s)
...
no leaks found
...
no leaks found
EXIT=0
```

## Scope and remaining boundary

Only the four files listed above changed for the implementation. No dependencies or lockfile changes, codegen, Convex deployment, or push. A cross-vendor review was not performed in this builder turn; the supplied review finding was addressed and mutation-tested, but remains subject to the required independent review and human integration process.
