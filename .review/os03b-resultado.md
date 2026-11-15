# os03b — LIVE CoDi QR wiring result

## Status

**PARTIAL — code and local gate are green, but WP-OS-03 is not ready for acceptance.** The LIVE QR adapter, creation guard, account preflight, authenticated QR/account-list verification, heartbeat chain, and bounded per-attempt recovery are wired. One required logging behavior cannot be completed inside the allowlist: failed/changed GETs cannot be recorded as sanitized `pey.llamada` entries because the existing bitácora registrar rejects read operations and `convex/motor/bitacora.ts` is out of scope. No real pey call, charge, deployment, push, merge, or independent review occurred.

## Base and history

- Started at `005514b` (`docs: registra la medición de la base os03b`) on `feat/pv-os03b-cableado`; no additional cherry-picks were made in this turn.
- The base already contained `8501b96` (merge of `origin/feat/pv-os02b-motor`) and `9930428` (merge of `origin/feat/pv-os03a-pey-cliente`). The common foundation commits `9d877df` and `f4ee513` have the same tree (`843efba`). See `.review/os03b-base-resultado.md` for the completed conflict union and codegen receipt.
- That report records `npm ci` with Node 24.22.2 and a baseline gate failure at `convex/motor/verificar.ts`: nullable `nextToken` assigned to `string | undefined`. I reran `npm run gate` before edits: exit **1**, same TS2322. The `nextToken ?? undefined` normalization now fixes it.
- Base conflict choices were left intact: os02b's durable simulator/port changes and os03a's LIVE client, wire shapes, account-list port, and reference-only QR listing.

## Local commits

- `d768301` — `feat: wire LIVE QR verification and recovery`
- Report commit: recorded after implementation commit (see final HEAD).

## What changed

- `packages/engine/src/pey/cliente.ts`, `esquemas.ts`: preserve the injected, fixed-host LIVE client; classify QR POST 429 as `incierto` (never blind-retry), preserve explicit unavailable link/global-list capabilities, skip account-list rows whose payable identity has no supported strict shape, and drop non-string *untrusted* external metadata while still validating PAYVRO correlation values.
- `convex/motor/peyPuerto.ts`, `convex/puertos.ts`: select the simulator only for DEMO and lazy-build the LIVE adapter from action-scoped credentials. The adapter's configured-account list has no caller-selected account. Missing configuration errors are safe `CUENTA_NO_ACTIVA` errors; only a boolean presence check enters the creation mutation.
- `convex/motor/cobros.ts`, `convex/cobros.ts`: fail closed before reservation unless configuration is present and cached account readiness is fresh `ACTIVE` (≤24h); reject LIVE links before reservation. Public signatures are unchanged.
- `convex/motor/cuenta.ts`, `tablas.ts`, `crons.ts`: internal account preflight/cache; stores only status enum and check time. Daily check cron is mode-safe. Governor entry point: `internal.motor.cuenta.comprobarCuenta` (Convex CLI function `motor/cuenta:comprobarCuenta`, no args).
- `convex/motor/verificar.ts`, `publico.ts`: QR references → individual authenticated transaction GETs → configured-account membership proof → existing `aplicarEvidencia`. Account membership and all QR pages are bounded; incomplete evidence is deferred. Heartbeat renews a single 60-second lease, recovers expired leases without resetting the 15-minute chain lifetime, and backs off on failures.
- `convex/motor/barrido.ts`: LIVE-only per-intento sweep, at most 20 verifications/run; no global provider cursor or invented IDs. Known discarded attempts are checked only while their cobro is ≤24h old. Unknown-payable discarded attempts are disabled without a provider request.
- `tests/pey/**`, `tests/motor/{sondeo,barrido,cuenta}.test.ts`, and `tests/motor/live-support.ts`: sanitized wire fixtures and Convex caller-boundary coverage. No UI, policy/state table, webhook route, or dependency changes.

## Red → green and mutation evidence

- **Client wire/outcome:** the new POST-429 test first failed with actual `{tipo:"rechazado"}`; after correction it passes and asserts one POST. The account-list fixture with `payableType: "UNRECOGNIZED"` and the supplied `01HXYZ1234567890ABCDEFGH00` example first failed schema parsing; after row-level identity skipping, the same page preserves its valid QR transaction. Test also proves unknown non-string external fields are dropped and non-string PAYVRO correlation is rejected.
- **Metadata mutation:** temporarily restored rejection of every non-string external field; the caller test failed `PEY_FORMA_INESPERADA` on the numeric untrusted `orderId`. Restored allowlist behavior.
- **Account-list mutation:** temporarily mapped every row directly through the transaction parser; the test with the unknown payable row failed. Restored selective skip.
- **GET redaction mutation:** temporarily rethrew the raw injected GET fetch error; the sentinel-key test failed because the sentinel appeared in the error. Restored sanitized `PEY_RED`.
- **Destination proof at its real caller:** temporarily initialized `destinoConfirmado = true`; the no-membership Convex action test returned `coincide` instead of `destino_distinto`. Restored the positive account-list membership gate.
- **Readiness/link guards:** temporarily removed the readiness check; the no-key creation test stopped returning `CUENTA_NO_ACTIVA`. Temporarily removed the QR-only guard; the LIVE link caller test failed because it received no `TRANSICION_INVALIDA`. Both restored.
- **No POST retry:** temporarily dispatched a second QR POST on HTTP 500; the Convex `intentos.crearEnPey` caller test observed 2 calls instead of 1. Restored one-shot behavior. Concurrent duplicate action delivery with a 500 is tested and results in one provider call and an `incierto` intento.
- **Backoff:** a real test initially found a defect: second consecutive GET 429 stayed at 2s instead of advancing to 4s. Fixed the threshold and observed 2s → 4s; test now passes. It uses fake pey responses only.
- All mutations were restored before the final gate. No mutation was made in `convex/motor/intentos.ts`, which is outside this WP's allowlist; its duplicate-dispatch guard is exercised through the real caller but was not mutated directly.

### Red commands and failing assertions

- Baseline: `npm run gate` → exit 1, `TS2322: string | null is not assignable to string | undefined` at `verificar.ts`'s pagination cursor.
- Initial wire tests: `npm test -- tests/pey/cliente.test.ts` → POST-429 assertion expected `incierto`, got `rechazado`; account-list test failed `PEY_FORMA_INESPERADA` on the unknown payable row.
- External-metadata mutation: `npm test -- tests/pey/cliente.test.ts -t 'reads configured-account transactions'` → `PEY_FORMA_INESPERADA` on numeric untrusted `orderId: 42`; restored.
- Account-row parser mutation: same command → `PEY_FORMA_INESPERADA` when all rows were parsed as transactions; restored.
- GET-sentinel mutation: `npm test -- tests/pey/cliente.test.ts -t 'never leaks the key through POST or GET'` → assertion found `key-sentinel-never-in-errors` in the raw GET error; restored.
- Destination-proof mutation: `npm test -- tests/motor/sondeo.test.ts -t 'holds paid QR evidence for review'` → actual result `coincide`, expected `destino_distinto`; restored.
- Readiness mutation: `npm test -- tests/motor/cuenta.test.ts -t 'refuses missing configuration'` → no `CUENTA_NO_ACTIVA`; restored. QR-only mutation: `npm test -- tests/motor/cuenta.test.ts -t 'requires fresh ACTIVE readiness'` → link assertion received no `TRANSICION_INVALIDA`; restored.
- POST retry mutation: `npm test -- tests/motor/cuenta.test.ts -t 'dispatched POST 500'` → fetch spy observed 2 calls, expected 1; restored.
- Backoff test: `npm test -- tests/motor/sondeo.test.ts -t 'backs off on a GET 429'` → second failure stayed at 2,000ms, expected 4,000ms; fixed threshold, rerun passed.

## Bounded constants

- Client timeout: **10s**. GET retries: at most **2 retries** (3 total requests), delayed 100ms / 200ms. QR POST is never retried.
- QR listing: max **10 pages**; account listing: max **10 pages**. The action defers instead of applying when a page cap leaves a cursor. Account proof can stop early only after every relevant paid transaction is found in the configured account list.
- Sondeo: **1.8s** nominal; failures **2s → 4s → 8s → 16s → 30s max**, reset after success. Heartbeat deadline **30s**, renewable lease **60s**, chain lifetime **15m**. Lease is rechecked before each outbound read.
- Sweep: every **1m**, at most **20** selected/verified attempts per invocation; created attempts first become eligible after **45s**; discarded attempts are reconsidered at **60s** intervals while their cobro is within **24h**.
- Account readiness cache: fresh for **24h**; daily cron. First LIVE use is blocked until the separate internal preflight has committed.

## Final command evidence

Final `npm run gate` after deleting anonymous local state: exit **0**.

- `npm run typecheck`: **0**.
- `npm run lint`: **0**, with the two existing unused-parameter warnings in `cliente.ts` (`_id`, `_nextToken`).
- `npm test`: **0**, 11 files / **89 tests passed**.
- `npm run build`: **0**.
- `npm run e2e`: **0**, 1 Playwright DEMO home test passed.
- `npm run secrets` under `scripts/gate.sh`'s generated-artifact allowlist: **0**, gitleaks reports no leaks in source/worktree or history. A later standalone `npm run secrets` without that allowlist exited **1** on 8 generated `.next` findings (58.8 MB scan); the gated command excludes `.next`/`.convex` and passed. No values were inspected or printed.
- `grep -rn 'NO_IMPLEMENTADO' convex packages | wc -l`: **0**.
- `grep -rlE 'api\.pey\.mx' --include='*.ts' app components lib convex packages`: only `packages/engine/src/pey/cliente.ts`.
- `git diff --check`: **0**.
- Anonymous Convex codegen: final `CONVEX_AGENT_MODE=anonymous npx convex dev --once --typecheck disable --tail-logs disable` exit **0**. The first attempt exposed missing anonymous-local `CLERK_JWT_ISSUER_DOMAIN`; set only on that anonymous local backend with `CONVEX_AGENT_MODE=anonymous npx convex env set CLERK_JWT_ISSUER_DOMAIN https://placeholder.invalid`, then reran successfully. `.convex/` and `.env.local` were deleted afterward; both remain absent.

No test called `api.pey.mx`; all transport tests inject fake fetch. No LIVE credentials were inspected and no external deployment was created.

## Blockers, dependencies, and scope left deferred

1. **Bitácora GET logging — BLOCKED by file ownership.** `verificar.ts` updates counters/check time and existing state application logs payment outcomes, but failed/changed GETs are not recorded as sanitized `pey.llamada`. `convex/motor/bitacora.ts` is not in the writable list and its current registrar rejects read operation names/details. Reusing `crear_qr` for a GET would be false logging, so this was not done. Needs an authorized follow-up that extends the registrar's allowlist/validation.
2. **POST 429 cause vocabulary.** It is safely uncertain and never re-POSTed; the os02b `ResultadoCrear`/`registrarIncierto` vocabulary has only `timeout | red | 5xx`, so the adapter uses the existing `5xx` transient bucket and os02b's delayed discard. That label is not literally the HTTP status; extending it truthfully would require the out-of-scope `intentos.ts`/bitácora changes.
3. **WP05 heartbeat integration is missing.** `rg 'vigilar' app components lib e2e` returned no matches. WP05 must call the unchanged public `publico.vigilar({publicId})` every 10s while the payer page is open; do not treat backend chain tests as UI integration evidence.
4. **LIVE deployment acceptance — NO MEDIBLE.** No authorized deployment, owner identity/config, ACTIVE account, or real payer was available. The required no-key/preflight behavior is proven only by `convex-test`; no LIVE deployment was created or queried. WP06 needs a dedicated LIVE deployment/config, authorized owner auth, and `internal.motor.cuenta.comprobarCuenta` returning ACTIVE before creation.
5. **OpenAPI snapshot — NO MEDIBLE.** The supplied path `/home/ulises/encargos/payvro-hack/inputs/pey-openapi-2026-11-14.json` returned `PermissionError`. Existing sanitized fixtures and merged os03a parsers were used; no new wire fact was added to `CONTEXT.md` §6.
6. **Independent review — pending.** No sub-agent was used. A reviewer from another vendor still needs the repo and must verify this branch; this report is not that review.

LIVE payment links remain unavailable and are rejected before reservation. Webhook verification/route and global API-key transaction discovery remain WP-OS-07. No `/volver`, portal webhook, payment launch, or real $0.01 charge was attempted. WP06 owns provisioning and the single $0.01 charge only after the founder's separate explicit OK.

## Handoff

Local branch only; no push. The result is useful for review but **not complete for WP acceptance** until the GET-bitácora limitation is resolved, WP05 calls the heartbeat, authorized WP06 prerequisites are met, and the independent review/deployment evidence is obtained.
