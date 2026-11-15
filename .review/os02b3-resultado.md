# os02b3 — persisted DEMO engine compile and Convex caller proof

## Status

**os02b3 local acceptance: MET.** The generated Convex API now includes the persisted motor modules; project typecheck, lint, tests, build, full gate, `lint-canon`, and the requested DEMO caller-boundary tests pass. The full workflow is proven in `convex-test`, including the public bitácora projection and zero outbound fetches.

**Overall WP-OS-02 acceptance remains pending.** No authorized `payvro-ops convex-dev` deployment was available, so the observable deployment exercise is **NO MEDIBLE**. Several broader tests from the original WP-OS-02 brief remain outside this continuation's six required cases; see “Remaining work”. No push, LIVE request, charge, or cloud deployment occurred.

## Commits

New commits for os02b3:

- `048ea89` — `chore: regenerate Convex API for persisted engine` (generated files only; committed separately).
- `108bbb1` — `fix: make persisted DEMO motor compile and verify`.
- `35e43f8` — `test: verify public DEMO bitácora ordering`.
- This report is committed separately after the implementation and tests.

Existing continuation history retained on this branch includes `8a6d1b7`, `6d831a9`, `d46c83f`, `8a993e6`, `1e945a5`, `2f5ae9f`, `0d42c1e`, and `692d378`. No history was rewritten.

## What changed

- Renamed the Convex-reserved `simPayables.by_id` index to `por_idSim` and updated its three query callers. Successful official codegen regenerated `_generated/api.d.ts`, data-model and server types with `motor/*`, `crons`, and `puertos` references. The generated commit is separate and was not hand-edited.
- Changed `pagos.resultado` from `v.string()` to the frozen literal union. Added explicit result/handler types where generated API inference formed recursive cycles. Once codegen succeeded, the previously reported `ctx.db.get` and summary-field errors disappeared; `npm run typecheck` is clean.
- Fixed evidence persistence for valid zero-valued fee and tip components. `aCentavos` correctly rejects zero as a cobro amount, but fee/tip may be zero; the evidence adapter now accepts zero only for those components and retains strict conversion for base and total.
- Split `crearSimulador` into cohesive helpers to satisfy the function-length canon without changing simulator behavior.
- Extracted the DEMO purge page deletion loop so pagination is one page per invocation and reschedules with the continuation cursor; the safety checks and DEMO-only bitácora deletion remain in place.
- Added `tests/motor/demo-flow.test.ts` with six `convex-test` cases. Tests call public functions for create/simulate/read and call the internal apply function only for the global transaction-claim adversarial case. The exact-flow test also checks persisted rows, public `panel.bitacora` ordering, and a fail-on-use `fetch` spy.

Changed paths are within the WP allowlist: `convex/_generated/**` (official codegen), `convex/motor/{peyPuerto,purga,tablas,verificar}.ts`, `packages/engine/src/pey/simulador.ts`, and `tests/motor/demo-flow.test.ts`. No UI, e2e, root config, lockfile, dependency, or docs source was changed. The report itself is the requested `.review` artifact.

## Test-audit authoring gate

- **Observable behavior:** public callers must create one charge/reservation per idempotency key; exact trusted simulator evidence releases once; mismatch and reused transaction evidence cannot release; LIVE authorization/mode and purge boundaries fail closed; the public bitácora projection preserves ascending sequence; DEMO makes no network request.
- **Credible regressions:** remove create deduplication or release; treat a higher base as equal; replay a simulator delivery; skip the global transaction claim; bypass the owner/mode/purge guards; reverse the public log order; or add an outbound fetch in the DEMO path.
- **Why prior coverage missed them:** the existing tests exercised pure engine policy/simulator functions, not the persisted Convex wrappers, scheduled actions, database writes, or public panel projection. They could not catch the zero-fee persistence failure or prove the guards were wired to callers.
- **Test-only production seam:** none added. The harness uses `convex-test`'s schema/module loader, real registered function references, and the existing internal mutation boundary.

## Required Convex tests

`tests/motor/demo-flow.test.ts`: **6 passed**.

| Required behavior | Evidence |
|---|---|
| Exact DEMO lifecycle | `cobros.crear` → scheduled payable creation → `demo.simularPago(exacto)` → scheduled verification/apply → one pago and one release. Default QR returns `qrString`. Persisted and public bitácora sequences are `cobro.creado`, `intento.reservado`, `pey.llamada`, `intento.creado`, `pago.verificado`, `cobro.liberado`, with `seq` 1–6. A mocked global `fetch` is never called. |
| Create idempotency | Same key/payload returns the same public id and folio; DB has one cobro, one intento, one reservation and one provider-call log. Changed amount returns `CLAVE_REUTILIZADA`. |
| Replay and global transaction uniqueness | Repeated exact simulation/evidence adds no pago/release. The same transaction id presented against a second cobro is rejected; the second remains `esperando_pago`. |
| Amount mismatch | `monto_distinto` persists a pago with that result and moves the cobro to `en_revision`; no release log exists. |
| LIVE authorization/isolation | Public create without owner identity returns `NO_AUTORIZADO`; a verified allowlisted identity can read the LIVE negocio; `demo.simularPago` by that owner in LIVE returns `SOLO_DEMO`. |
| Direct purge guard | Calling internal DEMO purge directly in LIVE returns `SOLO_DEMO`; the empty DEMO purge remains allowed. |

### Red and mutation evidence

Initial run after authoring the caller-boundary tests: **exit 1, 3 failed / 3 passed**. Exact flow and mismatch stayed unpaid because the real Convex apply path rejected the legitimate zero fee/tip with `MONTO_INVALIDO`; this exposed the production defect fixed above. The third red was a test-input mistake: the cross-cobro test spread database-only fields into the strict evidence validator (`Unexpected field`). The test was corrected to pass only the normalized evidence shape; that validator red is not counted as product evidence.

Each mutation below was run against its named caller-boundary test, observed red, and restored before the final suite:

| Mutated production guard/behavior | Observed targeted red |
|---|---|
| Removed `liberar(...)` from `aplicarEvidencia` | Expected `liberado`, received `pagado_verificado`. |
| Bypassed existing-key return in `crearCobro` | Repeated create returned folio 2/new id rather than the original folio 1/id. |
| Bypassed simulator replay protection **and** durable saved-variant protection | Expected one pago, received two. Mutating the simulator guard alone stayed green because the Convex adapter independently deduplicated the replay; the combined mutation confirmed the real caller test reaches both guards. |
| Bypassed the global `peyTransactionId` claim in `aplicarEvidencia` | The second-cobro call resolved instead of rejecting with `CLAVE_REUTILIZADA`. |
| Mutated base equality `===` to `>=` in the policy | Mismatch case released (`liberado/coincide`) instead of `en_revision/monto_distinto`. |
| Bypassed LIVE owner check and allowed an absent identity through the caller | The unauthenticated LIVE create resolved instead of returning `NO_AUTORIZADO`. |
| Bypassed both LIVE checks in `demo.simularPago` | Call resolved instead of returning `SOLO_DEMO`. |
| Disabled the direct purge mode guard | LIVE purge resolved instead of rejecting with `SOLO_DEMO`; the DEMO positive control still passes. |
| Added a mocked outbound fetch to the scheduled DEMO create caller | Full exact flow reached the spy and failed: expected no fetch, observed one call. The spy was mocked, so no network request left the test process. |
| Reversed the `panel.bitacora` cobro query from ascending to descending | Public projection returned `cobro.liberado` first; the expected ascending event sequence failed. |

All source mutations were restored. The targeted suite then passed 6/6, and the full suite passed 53/53.

## Codegen and local backend

- Node used: `v24.22.2` from `~/.local/share/payvro/runtimes/node-v24.22.2-linux-x64/bin`.
- `CONVEX_AGENT_MODE=anonymous npx convex dev --once --typecheck disable --tail-logs disable`: **exit 0**, local backend at `127.0.0.1:3212`; Convex accepted `por_idSim` and generated the API modules.
- Auth config required `CLERK_JWT_ISSUER_DOMAIN`; `CONVEX_AGENT_MODE=anonymous npx convex env set CLERK_JWT_ISSUER_DOMAIN https://placeholder.invalid`: **exit 0**, on the anonymous local deployment only. The first dev attempt (1) showed that setting it only in the shell does not populate Convex's local environment; it was then set locally and codegen succeeded.
- `.convex/` was removed after codegen. `.env.local` was present/ignored and was not staged or committed. No cloud deployment or `--prod` command was used.

## Gates and required checks

Node 24 was on `PATH` for npm commands. Exit codes:

| Command | Exit | Result |
|---|---:|---|
| `npm run typecheck` | 0 | App, engine and Convex TypeScript pass. |
| `npm run lint` | 0 | ESLint clean. |
| `npm test` | 0 | 7 files, 53 tests passed. |
| `npm run build` | 0 | Next production build and typecheck pass. |
| `npm run gate` | 0 | Full script including e2e and secrets scan passed; rerun on final report commit before handoff. |
| `lint-canon.sh pvos-os02b` | 0 | `LINT_OK`, `avisos=0`, `legado=R1b:0`. |
| `git diff --check` | 0 | Clean. |
| `test ! -d convex/_stub` | 0 | Stub directory absent. |
| `grep -rn 'NO_IMPLEMENTADO' convex packages | wc -l` | 1 hit | Sole hit is the LIVE seam in `convex/motor/peyPuerto.ts:180`. |

Full gate tail (typecheck, lint, 53 tests, build, e2e, secrets):

```text
 Test Files  7 passed (7)
      Tests  53 passed (53)
...
  ✓  1 e2e/humo.spec.ts:3:1 › home presents PAYVRO and the DEMO mode (1.2s)
  1 passed (3.5s)
...
scanned ~974687 bytes (974.69 KB) in 336ms
no leaks found
82 commits scanned.
scanned ~1537013 bytes (1.54 MB) in 728ms
no leaks found
```

The final report commit only adds this evidence file; the full gate is rerun on that final HEAD. No dependencies or lockfile were changed.

## Deployment exercise — NO MEDIBLE

No authorized `payvro-ops convex-dev` deployment was available, so these commands were **not run**. The governor can run them only after selecting the authorized DEMO deployment. Save each returned `publicId`, wait for `cobros.obtener` to show the attempt `creado`, and inspect `panel.bitacora` in ascending `seq`.

```bash
npx convex run cobros:crear '{"claveIdempotencia":"OS02B3-EXACTO-00000001","concepto":"Pedido de ejemplo","montoCentavos":14900}'
npx convex run cobros:obtener '{"publicId":"<publicId-exacto>"}'
npx convex run demo:simularPago '{"publicId":"<publicId-exacto>","variante":"exacto"}'
npx convex run cobros:obtener '{"publicId":"<publicId-exacto>"}'
npx convex run panel:bitacora '{"cobroPublicId":"<publicId-exacto>","paginationOpts":{"numItems":50,"cursor":null}}'

npx convex run cobros:crear '{"claveIdempotencia":"OS02B3-DISTINTO-00000001","concepto":"Pedido de ejemplo","montoCentavos":14900}'
npx convex run cobros:obtener '{"publicId":"<publicId-distinto>"}'
npx convex run demo:simularPago '{"publicId":"<publicId-distinto>","variante":"monto_distinto"}'
npx convex run cobros:obtener '{"publicId":"<publicId-distinto>"}'
npx convex run panel:bitacora '{"cobroPublicId":"<publicId-distinto>","paginationOpts":{"numItems":50,"cursor":null}}'

npx convex run cobros:crear '{"claveIdempotencia":"OS02B3-LINK-00000001","concepto":"Pedido de ejemplo","montoCentavos":14900,"tipo":"link"}'
npx convex run cobros:obtener '{"publicId":"<publicId-link>"}'
```

Expected observable result: exacto → `liberado`, one pago and one release; mismatch → `en_revision`, never `liberado`; the exact event chain above in ascending `seq`; QR default exposes `qrString`; explicit link exposes `urlPago`.

## Remaining work and decisions

- **NO MEDIBLE:** authorized Convex deployment scenario and persisted dashboard observation. This cannot be substituted by the local `convex-test` suite.
- **Independent review / `OPERATOR_VERIFY`:** not performed in this builder turn. No push, PR, merge, deployment, or founder approval was requested or performed.
- Broader original WP-OS-02 cases are still not proven by this continuation's six required tests: 25-way concurrent apply, cancel/retry and uncertain POST/60-second discard, late/extra payment, scheduled expiry and purge execution, hostile-argument enumeration across public exports, two-business isolation, rate-limit burst, and a full duplicate-payment lifecycle. Do not describe the entire WP-OS-02 as independently accepted until its required matrix is closed.
- Existing contract tension remains: the required/public `panel.bitacora` order is ascending `seq`, while `ARCHITECTURE.md` §8 describes newest-first. This code preserves ascending order required by the observed flow; the governor must settle the spec conflict before freezing the public order.
- Conservative decision: no broader API/schema or product-contract changes were made; `pagos.resultado` was narrowed only to the already frozen set of result literals.
