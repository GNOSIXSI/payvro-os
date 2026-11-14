# ADR-0009 — DEMO and LIVE are separate deployments; DEMO is a simulator behind the same port

- Status: Accepted (locked: DEMO never calls pey, LIVE uses $0.01 on the event's test accounts; mechanism designed 2026-11-14)

## Context

Facts
- pey has no sandbox; its docs recommend testing in production with small amounts.
- The submission needs a live link that a juror can try in a minute, without keys or money.
- A demo that fakes the result in the UI proves nothing about the engine.
- Mixing simulated and real payments in one database is the classic way to release real goods for fake money.

## Decision

1. Mode is a property of the **deployment**: `PAYVRO_MODE` in the Convex environment, `demo` or `live`, default `demo`. It is copied onto the negocio row at bootstrap; if the two ever differ, every money function refuses to run. A deployment never changes mode: going LIVE means a new deployment.
2. The engine talks to pey through `PeyPuerto`. LIVE uses `cliente.ts` (real HTTP). DEMO uses `simulador.ts`, which answers with the same shapes from two DEMO tables. Everything above the port — state machine, verification policy, bitácora, idempotency — is the same code in both modes.
3. `cliente.ts` refuses to construct unless the mode is `live`. `demo.simularPago` refuses unless the mode is `demo`. A test injects a `fetch` that fails the test if called in DEMO.
4. DEMO needs no pey key and no Clerk keys. The panel is open; writes are rate limited; DEMO rows older than 24 h are purged by a cron. The `DEMO` tag is on every screen.
5. `demo.simularPago` offers variants (`exacto`, `monto_distinto`, `duplicado`, `tarjeta`) so the review paths can be shown without money.
6. Every row also records `modo`, as an audit field. It is never used to decide authorization.
7. LIVE tests during the hackathon are $0.01 charges on the event's pre-authorized test accounts, each one with the founder's OK. Those accounts' CLABEs and holders' names never enter the repo.

## Consequences

- The public demo link exercises the real engine and cannot move money.
- Two deployments to run for the submission: an open DEMO one and an owner-only LIVE one.
- The simulator must track pey's real shapes. When a LIVE response contradicts the simulator, the simulator is fixed in the same PR.
- An open DEMO panel can be spammed. Rate limits and the purge bound the damage; the deployment holds nothing of value.
