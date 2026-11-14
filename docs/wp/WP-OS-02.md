---
id: WP-OS-02
title: "Motor en DEMO: estados, bitácora, idempotencia, simulador"
lane: astra
reviewers: [opus, gemini]
depends_on: [WP-OS-01]
size: L
milestone: M1
---

# WP-OS-02 — Motor en DEMO: estados, bitácora, idempotencia, simulador

## Goal

The whole engine working in DEMO: a cobro can be created, paid in the simulator, verified by the same policy LIVE will use, and released exactly once, with every step in the append-only bitácora.

## Files it may touch

- `packages/engine/src/estados.ts`, `verificacion.ts`, `pey/tipos.ts`, `pey/puerto.ts`, `pey/simulador.ts`, `index.ts`
- `convex/schema.ts`
- `convex/motor/**` (`tablas.ts`, `puertos.ts`, `cobros.ts`, `intentos.ts`, `verificar.ts`, `liberar.ts`, `bitacora.ts`, `peyPuerto.ts`, `limites.ts`)
- `convex/puertos.ts`
- `convex/negocio.ts`, `convex/cobros.ts`, `convex/panel.ts`, `convex/publico.ts`, `convex/demo.ts` (replace the stubs; keep names, arguments and return types)
- `convex/crons.ts` (expiry and DEMO purge only)
- `convex/_stub/**` (delete)
- `tests/estados.test.ts`, `tests/verificacion.test.ts`, `tests/simulador.test.ts`, `tests/motor/**`

## Files it must not touch

`app/**`, `components/**`, `lib/**`, `e2e/**`, `packages/engine/src/pey/cliente.ts`, `packages/engine/src/webhook.ts`, `convex/http.ts`, root config, `docs/**`, the five root docs. If a signature in `ARCHITECTURE.md` §8 has to change, stop and say so in the PR.

## Steps

1. `estados.ts`: the two transition tables of `ARCHITECTURE.md` §5 as data, plus `transicionarCobro(estado, evento)` and `transicionarIntento(estado, evento)` that return the next state or throw `TRANSICION_INVALIDA`. No other code assigns a state.
2. `pey/tipos.ts` and `pey/puerto.ts`: the `PeyPuerto` interface and result types of §6.2. Types mirror the pey OpenAPI field names (`amountBreakdown`, `payableType`, …).
3. `verificacion.ts`: `evaluar(esperado, evidencia)` exactly as §6.3. Pure, no dates, no I/O.
4. `pey/simulador.ts`: `PeyPuerto` over an injected store interface. It produces the same shapes as pey, including `amountBreakdown` and string metadata. Variants for `pagar`: `exacto`, `monto_distinto` (base differs by 100 centavos), `duplicado` (two paid transactions), `tarjeta` (`paymentMethod: "CARD"`, with a fee).
5. `convex/motor/tablas.ts`: every table and index of §4, exported as `tablasMotor`. `convex/schema.ts` spreads it.
6. `convex/motor/puertos.ts`: the `PuertosMotor` interface of §6.5. `convex/puertos.ts`: the OS implementation — DEMO returns the single demo negocio (created on first use); LIVE requires a Clerk identity with a verified email in `PAYVRO_OWNER_EMAILS` and otherwise throws `NO_AUTORIZADO`. `credencialPey` throws `MODO_INVALIDO` in DEMO.
7. `convex/motor/bitacora.ts`: `registrar(ctx, entrada)` — the only insert into `bitacora`; assigns `seq` from the negocio counter in the same mutation; validates `detalle` against a per-type schema.
8. `convex/motor/cobros.ts` + `intentos.ts`: create with idempotency (`CLAVE_REUTILIZADA` on same key / different input), folio counter, reserve intento, one live intento per cobro, cancel, retry. `crearEnPey` is an internal action: build the port with `peyPuerto.ts`, call it once, hand the result to an internal mutation (`registrarCreado` / `registrarFallido` / `registrarIncierto`). An `incierto` intento is discarded by a scheduled mutation after 60 s.
9. `convex/motor/verificar.ts`: `aplicarEvidencia` as §6.4 (one mutation, idempotent, the only writer of `pagado_verificado`); `verificarIntento` internal action (read through the port → `aplicarEvidencia`). `liberar.ts`: the release step, guarded by `liberadoEn`.
10. `convex/motor/peyPuerto.ts`: returns the simulator when `modo() === "demo"`. For `live`, import the client lazily and throw `NO_IMPLEMENTADO` until WP-OS-03 (leave a single clearly marked seam).
11. Public wrappers (`convex/cobros.ts` etc.): validators, `resolverNegocio`, call into `motor`, map to the return types of §8. `publico.cobro` returns the redacted view only; unknown and malformed ids both return `null`. `demo.simularPago` throws `SOLO_DEMO` outside DEMO, then schedules `verificarIntento`.
12. `convex/motor/limites.ts`: a small fixed-window limiter in a table, applied to `publico.vigilar`, `demo.simularPago` and `cobros.crear` in DEMO.
13. `convex/crons.ts`: every minute expire `esperando_pago` cobros past `expiraEn`; hourly delete DEMO rows older than 24 h (DEMO deployments only; the bitácora purge is the single exception to append-only and exists only where `modo = demo`).
14. Tests (convex-test for the Convex layer). Each seen failing first:
    - Transitions: every legal row of §5; every illegal pair throws.
    - `evaluar`: `sin_pago`; `coincide`; base 14900 + fee 600 on a 14900 cobro → `coincide`; base 14300 + fee 600 → `monto_distinto`; `CARD` → `metodo_no_permitido`; tip > 0 → `con_propina`; link `partial` → `parcial`; two paid → `duplicado`; wrong `payableId`; wrong `clientReferenceId`; `PENDING` transaction ignored.
    - Idempotency: `cobros.crear` twice with one key → one cobro, one folio; same key with another amount → `CLAVE_REUTILIZADA`.
    - Record before call: with a port whose `crearLink` throws, the cobro and the `reservado` intento already exist, and the bitácora has `intento.reservado`.
    - Unknown outcome: port returns `incierto` → intento `incierto`, **zero** further calls to `crearLink`, then `descartado`; `cobros.reintentar` creates a new intento.
    - Replay: `aplicarEvidencia` twice with the same evidence → one pago, one `cobro.liberado`.
    - Concurrency: 25 `aplicarEvidencia` in `Promise.all` → one pago, one liberación.
    - Global claim: evidence carrying a transaction id already bound to another cobro → refused, second cobro not released.
    - Late payment: expire a cobro, then apply paid evidence → `en_revision` with `pago_tardio`.
    - Authority: enumerate every exported public function of `convex/*.ts`; call each with hostile extra fields (`estado`, `negocioId`, `verificado`) → validator rejects; none can move a cobro to `pagado_verificado`.
    - Append-only: a source scan finds no `patch`/`replace`/`delete` on `bitacora` outside the DEMO purge; a state change without a bitácora entry is impossible (assert entry count after each transition).
    - Two negocios: run the motor tests against the fake two-tenant `PuertosMotor`; negocio B cannot read or pay negocio A's cobro by id.
    - DEMO isolation: a `fetch` spy fails the test if anything calls it during a full DEMO flow.
    - Limits: burst on `publico.vigilar` → `DEMASIADAS_SOLICITUDES`.

## Done criterion

Observable
- In `npx convex dev` (DEMO), from the Convex dashboard or a script: `cobros.crear` → cobro `esperando_pago` with a simulated `urlPago`; `demo.simularPago({variante: "exacto"})` → `liberado`; `panel.bitacora` shows `cobro.creado`, `intento.reservado`, `pey.llamada`, `intento.creado`, `pago.verificado`, `cobro.liberado` in `seq` order.
- `demo.simularPago({variante: "monto_distinto"})` on another cobro → `en_revision`, never `liberado`.
- No file under `convex/_stub/` remains; no `NO_IMPLEMENTADO` except the LIVE seam in `peyPuerto.ts`.

Commands that must pass
```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run gate
grep -rn "NO_IMPLEMENTADO" convex packages | wc -l   # prints 1
```

In the PR: the list of tests with the failing assertion seen for each group, and one mutation check — change `base === esperado.montoCentavos` to `>=` in `verificacion.ts`, show which test fails, revert.

## Out of scope

Real pey HTTP client, sondeo loop, webhook route, listing sweep, QR, resolution of `en_revision`, any UI.

## Risks

- Convex scheduling and convex-test: scheduled functions need explicit advancing in tests. Read the convex-test docs for the current API before writing the concurrency and expiry tests.
- Counter contention on the negocio row (folio, seq) is fine for one business; do not optimize it.
- Changing a return type silently breaks WP-OS-04, which is being built at the same time against the stubs. The types of §8 are frozen for this package.
- The DEMO purge deletes bitácora rows. Guard it by mode inside the function, not only by where the cron is registered, and test that it throws in LIVE.
