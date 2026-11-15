# os03a — result for current HEAD

## Status

**Implementation committed; acceptance is blocked, not gate-green.** The worktree has no dependency installation, so the required Vitest/lint/build/gate commands could not run. The Live link pre-reservation guard and durable duplicate-dispatch behavior also need their real motor caller in os03b. No push or real pey request was made. Handoff requested: `OPERATOR_VERIFY` after the gaps below are checked.

## Commits

- `57664ec67824506bb64f048c7f4a533b0ba53378` — required os02 foundation cherry-pick: port/types, simulator, policy.
- `b94e306fa78ad1c3e2243159aaa9fe89fd4ebf8a` — required os02 evidence cherry-pick.
- `60c124baa0ccc3a4c29a56cc554beda1c3e9ba94` — `feat: add fail-closed pey QR client`.

## What changed and why

- Added `packages/engine/src/pey/cliente.ts`: injected fetch, fixed `https://api.pey.mx`, bearer header, `redirect: "error"`, 10-second abort, strict request IDs, one-shot QR POST, bounded GET retries, surfaced 429, safe provider errors, and no logs.
- Added `esquemas.ts` to validate provider responses and normalize wire `id`, epoch-second dates, `items`/nullable `nextToken`, and nested `metadata.externalMetadata`. Missing base, currency, identity, and PAID date fail closed. Only zero tip/fee components default to zero; `applicationFee` and payer banking/nested fields are discarded. Account reads return only `codiStatus` and must identify the configured account.
- Added the configured-account transaction-list operation to `PeyPuerto`. QR listing now returns references (`transactionId`) only; it does not fabricate payable identity from the requested QR id. os03b must call `leerTransaccion` for each reference.
- Made unsupported LIVE link operations and API-key-wide listing throw `NO_IMPLEMENTADO` before any HTTP request. No link, `/volver`, or API-key scan endpoint was implemented.
- Updated the simulator only for the changed QR-reference page and configured-account-list port; it remains network-free.
- Added sanitized fixtures with placeholder account/transaction IDs and CLABE; no real person/account data.

## Test authoring gate

- **Observable behavior:** the public `PeyPuerto` calls send the exact QR request, classify outcomes, reject unsafe paths, and return normalized/redacted wire data.
- **Credible regressions:** centavo conversion/body drift, accepting malformed success or missing evidence, path injection, POST retry, leaking payer metadata, or treating QR list rows as complete transactions.
- **Why existing coverage did not catch these:** the existing tests covered the simulator/policy, not the LIVE HTTP boundary or recorded pey wire shapes.
- **Test-only seam:** none. Injected `fetch` is a required production boundary, not a test-only hook.

The simulator test was changed at its public boundary: a QR list yields references, and the caller reads the transaction by that reference. This protects the new port contract; old simulator assertions expected a full transaction from the QR list and therefore could not catch the missing-real-wire-fields risk.

## Tests and mutation evidence

**The committed Vitest tests were not executable here.** `npm test -- tests/pey/cliente.test.ts` stopped before test discovery with `sh: 1: vitest: not found`; it did not produce a Vitest assertion red/green. No dependencies were installed, per instructions.

Evidence available in this worktree:

- `tsc --noEmit -p packages/engine/tsconfig.json` — exit 0 (global TypeScript 5.9.3; this is not the lockfile toolchain).
- A targeted TypeScript check of `tests/pey/cliente.test.ts` and `tests/simulador.test.ts` with a temporary ambient Vitest declaration — exit 0; this checks syntax/types only, not test execution.
- Compiled the engine to `/tmp` with global `tsc` and ran a dependency-free Node assertion harness against the actual client — passed: QR body and 1-centavo conversion, POST one-call behavior, missing-currency rejection, account redaction, and path rejection.
- **Mutation — missing currency:** mutated the normalizer to default absent currency to `MXN`; the runtime assertion failed with `AssertionError: Missing expected rejection.` (exit 1). Restored the source; the baseline harness passed.
- **Mutation — POST retry:** mutated the 5xx branch to dispatch a second POST; the runtime assertion failed with `AssertionError: Expected values to be strictly equal: 2 !== 1` (exit 1). Restored the source; `git diff --exit-code` confirmed both mutated production files byte-identical to HEAD.
- The Vitest test for the real 10-second abort and POST call count is present but remains unrun. The duplicate *action-dispatch* half is not proven by this adapter-only harness; it belongs at os02b's durable motor dispatch caller.
- `git diff --check` — exit 0.
- `grep -rn "fetch(" packages/engine/src | grep -v cliente.ts` — no matches outside `cliente.ts`.
- No real network calls; all runtime assertions used injected fake fetch.

## Required command evidence

| Command | Result |
|---|---|
| `npm run typecheck` | **exit 2** — dependencies/types are absent (`next`, `react`, `convex`, `vitest`, Playwright, Node types); global `tsc` then reports the resulting unresolved modules and derivative errors. Engine-only typecheck passed separately above. |
| `npm run lint` | **exit 127** — `eslint: not found`. |
| `npm test` | **exit 127** — `vitest: not found`. |
| `npm run build` | **exit 127** — `next: not found`. |
| `npm run gate` | **exit 2**, foreground — stopped at `typecheck`; tail reports missing Convex/Playwright/Vitest modules and `exit=2`. |

Installing dependencies to make these pass was prohibited. There is no green gate evidence; run the required commands with the locked project dependencies before considering the package done.

## Decisions taken

- Kept the accepted internal `TransaccionPey` date strings; wire epoch seconds normalize to ISO, leaving the persistence boundary as the only conversion to stored milliseconds.
- Validated transaction and configured bank IDs as ULIDs. QR IDC is validated as a bounded opaque path-safe identifier, not a ULID. CoDi push payable IDs use the documented 20-digit identifier when encountered in account transaction pages.
- Missing documented zero `tip`/`fee` components normalize to zero. Missing base, currency, transaction/payable identity, or PAID date rejects the response.
- Account listing stays bound to the configured account. API-key-wide scanning is unsupported, not an empty/simulated success.

## Gaps and doubts for the orchestrator

1. **Link before reservation:** the adapter fails closed with `NO_IMPLEMENTADO` and sends no request, but this scope excludes the motor/cobros caller that owns reservation. os03b must reject `tipo: link` with the existing safe domain error *before* reservation and test that caller. This acceptance item is not claimed complete here.
2. **Duplicate action dispatch:** the adapter never retries within one POST invocation. Durable duplicate-dispatch protection is a motor responsibility; this branch has no motor implementation to exercise. os03b must test the durable caller and show one provider POST.
3. **Gate environment:** the operator must make the locked dependencies available without changing the lockfile, then run the full gate and committed Vitest suite before review.
4. **Process deviation:** initial read/check tool calls used the parallel wrapper despite the prompt's “no parallel” instruction. No subagent was spawned and no other worktree was touched; all later commands and mutations were serial. This should be considered in the operator's process review.
