# WP-OS-02 continuation — os02b result

## Status

**INCOMPLETE — do not treat WP-OS-02 as accepted or ready to stack WP-OS-03.** Persisted DEMO lifecycle code and the policy fixes are committed, but the Convex-generated API was not regenerated, the project test/gate commands could not run because this worktree has no dependencies, the required `convex-test` behavior suite is absent, and the deployment acceptance was not measurable. No push, deploy, LIVE call, or spend occurred.

**BLOQUEO:** This worktree has no `node_modules`; `convex-locked.sh "$PWD" -- codegen` exits 3 because `node_modules/.bin/convex` is absent. Installing dependencies is explicitly forbidden. The generated API therefore still lacks the new internal module references. A dependency-prepared authorized environment must run the locked codegen, then typecheck and the behavior suite before this work can be accepted.

## Commits

- `8a6d1b7` — `feat: add PAYVRO engine policy and simulator foundations` (required cherry-pick of `daf921b`).
- `6d831a9` — `docs: record OS-02 implementation evidence and gaps` (required cherry-pick of `436716d`).
- `d46c83f` — `feat: persist DEMO payment lifecycle in Convex`.
- `8a993e6` — `fix: fail closed on legacy create idempotency`.
- Final report is committed separately after this implementation state. Branch HEAD before the report commit: `8a993e610375179d6eb94c3a31a301c2001d3f24`.

The two required cherry-picks applied cleanly; no conflict resolution was needed. `luna-os02.log` was not present at the requested repo path, so only `.review/os02-resultado.md` was available as prior-gap evidence. The branch is local and ahead of its remote; it was not pushed.

## Files changed

Within the WP-OS-02 allowlist: `convex/_stub/fixtures.ts` (deleted); `convex/{cobros,demo,negocio,panel,publico,puertos,crons}.ts`; `convex/motor/{tablas,bitacora,cobros,intentos,liberar,limites,peyPuerto,puertos,purga,verificar}.ts`; `packages/engine/src/{pey/simulador.ts,pey/tipos.ts,verificacion.ts}`; and `tests/{simulador,verificacion}.test.ts`. No UI, root config, docs, generated files, dependencies, or `.env*` files were changed. Generated files were not edited by hand.

## Acceptance items

1. **Ports and authorization — partial.** DEMO negocio bootstrap occurs only in write handlers; LIVE owner resolution checks identity email and its verified claim against `PAYVRO_OWNER_EMAILS`; persisted/environment mode mismatch is rejected; credential access refuses DEMO and returns LIVE credentials only to an action caller. No direct authz tests were run, and codegen/typecheck remain blocked.
2. **Atomic append-only bitácora — partial.** `motor/bitacora.ts::registrar` is the sole insert path, increments `seqBitacora` in the same transaction, and validates event-specific detail keys/values. No public update/delete path was added. DEMO purge is the only delete exception. No Convex DB test proves this wiring.
3. **Persisted cobro/intento lifecycle — partial.** Creation validates amount/concept/idempotency, defaults to QR, persists cobro + reserved intento + log before scheduling one action, and handles retry/cancel/uncertain outcomes with an atomic post-claim guard. Uncertain attempts schedule discard after 60 seconds. The required concurrent-call, failed-port, retry, cancel, and DB-log tests were not implemented or run.
4. **Durable simulator — partial.** `crearSimulador` now accepts sync or async store methods; the Convex adapter persists payables and transactions through internal mutations and reads them through indexed/paginated queries. Repeated same-variant simulation is idempotent; a distinct duplicate variant remains representable. The simulator produces an overpayment for a 1-centavo mismatch. No deployed or convex-test flow was run. `NO_IMPLEMENTADO` appears once at `convex/motor/peyPuerto.ts` for LIVE only.
5. **Evidence and release — partial.** The internal verification action reads through the port; `aplicarEvidencia` derives values from rows, claims transaction IDs globally in the mutation, applies transitions, writes pagos/logs atomically, releases once, routes late payment to review, and holds distinct post-release payment as duplicate. No replay/concurrency/second-cobro integration tests were run.
6. **Policy foundation — code implemented; runner tests unverified.** Link evidence now requires a fetched link with exact reference; QR evidence requires positive destination confirmation; base-vs-total equality and fee/tip support remain; internal normalization and ISO timestamp conversion are documented/explicit. Existing overpayment test remains and simulator mismatch uses +100 centavos.
7. **Public wrappers — partial.** Fixture reads and public stubs were replaced; validators and return projections remain constrained; panel/negocio/cobros resolve the negocio; public payer reads are redacted; malformed and unknown IDs return null; heartbeat is limited and persisted. No tick chain was added (WP-OS-03). No hostile-argument/authz/tenant-boundary caller tests were run. `panel.bitacora` exposes cobro-linked entries only because the frozen return shape requires `cobroPublicId`; business-level entries are omitted from this projection.
8. **Expiry, purge, and limits — partial.** Minute expiry and hourly DEMO-only purge are scheduled; purge also checks mode when invoked directly and paginates one table per execution; DEMO create/simulation/heartbeat have fixed-window limits. Scheduled handlers and LIVE purge rejection were not exercised in convex-test.
9. **Required behavior proof — NOT MET.** No `tests/motor/**` suite was added. The new engine tests were not runnable in Vitest in this environment. There is no full persisted DEMO acceptance evidence, public-export hostile-argument enumeration, 25-way apply test, authz mutation, network spy at Convex caller, or real scheduled-handler test.

## Test-audit authoring gate for new/changed tests

- **Observable behavior:** missing positive link/QR proof must not verify; valid positive proof must still verify; a one-centavo mismatch must create valid evidence differing by 100 centavos; repeated simulation of the same variant must not add a second event, while a distinct duplicate variant can add distinct payments.
- **Credible regression:** omit the link GET/reference or QR destination confirmation; over-broaden the proof guard so valid payments are rejected; regress the simulator mismatch to subtract 100 cents (negative amount for a 1-centavo cobro); or remove the variant replay guard.
- **Why existing coverage missed it:** existing verification tests only had a wrong nonempty link reference and no absent-proof QR case; simulator tests used ordinary amounts and one delivery per variant, so neither the one-centavo underflow nor repeated delivery was covered.
- **Test-only seam:** none added. The policy tests call the policy owner; the simulator tests call the exported simulator interface used by the Convex durable adapter. This does not substitute for the missing Convex caller-boundary tests.

## Red/green and mutation evidence

Vitest itself could not start (`vitest: not found`), so the following are direct Node assertions against the production TypeScript owner, not claims that `npm test` passed:

- Link guard removed: assertion expecting missing-proof `revisar/destino_distinto` failed because the mutant returned `coincide` (exit 1). The valid-link control also went red when the guard was mutated to reject all links. Both mutations were restored.
- QR proof guard regressed to checking only explicit `false`: missing-proof assertion failed because it returned `coincide` (exit 1). The positive `destinoConfirmado: true` control went red when mutated to reject every QR. Restored.
- Required `base === esperado` → `>=` mutant: the overpayment assertion failed because a 15000-centavo base on a 14900-centavo charge returned `coincide` (exit 1). Restored `===`.
- Simulator mismatch mutated back to `-100`: a 1-centavo mismatch threw `RangeError: MONTO_INVALIDO` instead of producing 1.01 pesos of provider-shaped evidence (exit 1). Restored +100.
- Simulator replay guard removed: calling the same exact variant twice produced 2 transactions when the assertion expected 1 (exit 1). Restored. A separate valid simulator assertion confirmed that a different `duplicado` variant can still add two additional transactions.
- After restoration, the direct positive/negative policy assertions printed `verification positive/negative assertions passed`; the simulator check printed `simulator centavo and idempotency assertions passed`. These manual checks do not replace Vitest or Convex integration tests.

## Command evidence

| Command | Exit | Evidence |
|---|---:|---|
| `/usr/bin/tsc --noEmit -p packages/engine/tsconfig.json` | 0 | Engine package typecheck passed. |
| `git diff --check` | 0 | No whitespace errors. |
| `npm run typecheck` | 2 | Missing installed Next/React/Convex/Playwright/Vitest type packages; the full project typecheck cannot be evaluated. |
| `npm run lint` | 127 | `eslint: not found`. |
| `npm test` | 127 | `vitest: not found`. |
| `npm run build` | 127 | `next: not found`. |
| `npm run gate` | 1 | Stopped at its first step, `npm run typecheck`; same missing-package errors. Lint, tests, build, E2E, and gate secrets stage were not reached by this gate run. |
| `npm run secrets` | 0 | Gitleaks scanned worktree and 52 commits; no leaks found. |
| `~/.local/bin/convex-locked.sh "$PWD" -- codegen` | 3 | Required pinned Convex binary is absent at this worktree's `node_modules/.bin/convex`; no `npx` fallback used. |
| `test ! -d convex/_stub` | 0 | Stub directory removed. |
| `grep -rn 'NO_IMPLEMENTADO' convex packages` | 0 | Exactly one hit, the LIVE seam in `convex/motor/peyPuerto.ts`. |

The absence of `node_modules` is why no package installation was attempted. The generated API still needs the locked codegen after dependencies are made available.

## Deployment acceptance — NO MEDIBLE

No authorized Convex DEMO deployment was available to this worker. The local suite and manual policy checks are not substitutes. The governor must run the following against the authorized `payvro-ops convex-dev` DEMO deployment after codegen and gate prerequisites are satisfied. Use the pinned wrapper rather than `npx convex`:

```bash
~/.local/bin/convex-locked.sh "$PWD" -- run cobros:crear '{"claveIdempotencia":"OS02B-EXACTO-00000001","concepto":"Pedido de ejemplo","montoCentavos":14900}'
# Save the returned publicId; query until intentoActivo.estado is "creado" and cobro.estado is "esperando_pago".
~/.local/bin/convex-locked.sh "$PWD" -- run cobros:obtener '{"publicId":"<publicId-exacto>"}'
~/.local/bin/convex-locked.sh "$PWD" -- run demo:simularPago '{"publicId":"<publicId-exacto>","variante":"exacto"}'
~/.local/bin/convex-locked.sh "$PWD" -- run cobros:obtener '{"publicId":"<publicId-exacto>"}'
~/.local/bin/convex-locked.sh "$PWD" -- run panel:bitacora '{"cobroPublicId":"<publicId-exacto>","paginationOpts":{"numItems":50,"cursor":null}}'

~/.local/bin/convex-locked.sh "$PWD" -- run cobros:crear '{"claveIdempotencia":"OS02B-DISTINTO-00000001","concepto":"Pedido de ejemplo","montoCentavos":14900}'
# Save the second publicId; wait for intentoActivo.estado "creado" / cobro.estado "esperando_pago".
~/.local/bin/convex-locked.sh "$PWD" -- run demo:simularPago '{"publicId":"<publicId-distinto>","variante":"monto_distinto"}'
~/.local/bin/convex-locked.sh "$PWD" -- run cobros:obtener '{"publicId":"<publicId-distinto>"}'
~/.local/bin/convex-locked.sh "$PWD" -- run panel:bitacora '{"cobroPublicId":"<publicId-distinto>","paginationOpts":{"numItems":50,"cursor":null}}'

~/.local/bin/convex-locked.sh "$PWD" -- run cobros:crear '{"claveIdempotencia":"OS02B-LINK-00000001","concepto":"Pedido de ejemplo","montoCentavos":14900,"tipo":"link"}'
# Save the third publicId and query cobros:obtener until intentoActivo.urlPago is present.
~/.local/bin/convex-locked.sh "$PWD" -- run cobros:obtener '{"publicId":"<publicId-link>"}'
```

Required observable result remains unmeasured here: exacto → `liberado`; monto_distinto → `en_revision`; the exacto log chain in ascending `seq`: `cobro.creado`, `intento.reservado`, `pey.llamada`, `intento.creado`, `pago.verificado`, `cobro.liberado`; QR returns `qrString`; explicit link returns `urlPago`.

## Decisions and remaining contradictions

- Kept an absent/empty `PAYVRO_MODE` defaulting to DEMO, which cannot initiate LIVE I/O; persisted LIVE rows still fail closed against that mode. The authorized deployment should set the mode explicitly.
- `panel.bitacora` is ordered ascending by `seq` to satisfy this task's observable criterion. `ARCHITECTURE.md` §8 says newest-first; this conflict needs governor confirmation before the public order is treated as frozen.
- Business summary counters are optional for legacy rows. A preexisting business without `enRevisionCount` or daily counter values can report zero until a safe backfill/reconciliation is decided. No deployment inspection was possible.
- Public `panel.bitacora` requires a cobro public id in each row; business-only events such as `negocio.actualizado` are persisted but omitted from this projection. A contract change is outside this WP.
- During initial read-only inspection, two calls accidentally used the parallel tool despite the instruction not to use parallel. No subagent was spawned, and no concurrent edits or mutations occurred.

## Handoff

The work is committed locally, not pushed. It is **not complete** and should not be accepted on the basis of the passing engine-only typecheck, manual assertions, or gitleaks result. First prepare the authorized dependency environment, run locked codegen, add/run the missing `convex-test` caller-boundary suite, complete all gates, and obtain the DEMO deployment evidence above. Independent review and `OPERATOR_VERIFY` remain pending.
