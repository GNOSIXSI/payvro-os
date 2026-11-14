---
id: WP-OS-11
title: "Motor versionado: manifiesto, etiqueta y contrato para Cloud"
lane: sol
reviewers: [sonnet]
depends_on: [WP-OS-07]
size: S
milestone: M2
---

# WP-OS-11 — Motor versionado para Cloud

## Goal

The engine has a declared surface and a version, so PAYVRO Cloud can copy an exact, verifiable release of it (ADR-0008).

## Files it may touch

- `motor.manifest.json`
- `packages/engine/package.json` (version), `packages/engine/LICENSE` (copy of the FSL-1.1-ALv2 license, travels with the vendored code), `packages/engine/README.md`
- `convex/motor/README.md`
- `scripts/motor-manifiesto.mjs`, `package.json` (script `motor:manifiesto`), `scripts/gate.sh`
- `tests/motor/dos-negocios.test.ts`, `tests/motor/manifiesto.test.ts`
- `docs/motor-contrato.md`

## Files it must not touch

Any engine source file, except to move something single-tenant out of `convex/motor/` if the test in step 3 finds it (list every move in the PR).

## Steps

1. `motor.manifest.json`: `{ "version": "0.1.0", "paths": ["packages/engine/", "convex/motor/"], "puertos": "convex/motor/puertos.ts", "tablas": "convex/motor/tablas.ts" }`.
2. `scripts/motor-manifiesto.mjs --check`: fails if a file under the manifest paths imports anything outside them (other than `convex/server`, `convex/values`, `_generated`, and the `PuertosMotor` implementation via the port file), reads `process.env`, or references `PAYVRO_OWNER_EMAILS` or any other OS-only name. Added to the gate.
3. `tests/motor/dos-negocios.test.ts`: the full motor suite's core scenarios against a fake `PuertosMotor` with two negocios and two credentials: create, pay, verify, release in A; B sees nothing; a pey transaction of A presented to B is refused; counters (`folio`, `seq`) are independent.
4. `docs/motor-contrato.md`: what Cloud may rely on — manifest paths, `PuertosMotor`, `tablasMotor` table and index names, internal function paths under `motor/`, error codes — and the versioning rule: patch = no contract change; minor = additive; major = anything Cloud must change. Tag format `motor-vX.Y.Z`.
5. `packages/engine/README.md` and `convex/motor/README.md`: ten lines each: what this directory is, that it is vendored into Cloud unmodified, and the rule "nothing single-tenant here".

## Done criterion

Commands that must pass
```bash
npm run gate
npm run motor:manifiesto -- --check
npx vitest run tests/motor/dos-negocios.test.ts tests/motor/manifiesto.test.ts
```

Seen failing first: add `process.env.X` to a motor file → the check fails → revert.

After merge the founder (or the orchestrator with his OK) creates the tag `motor-v0.1.0` on the merge commit. Tagging is not part of the PR.

## Out of scope

The sync script (lives in Cloud, WP-CL-03), publishing to npm, changelog tooling.

## Risks

- Something single-tenant may already have leaked into `convex/motor`. Moving it out is the point of this package; do it in small commits.
- Internal function paths become a contract the moment Cloud schedules them. Renaming one later is a major version.
