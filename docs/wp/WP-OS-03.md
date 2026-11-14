---
id: WP-OS-03
title: "pey LIVE: cliente, verificación, sondeo y barrido por intento"
lane: astra
reviewers: [opus, gemini]
depends_on: [WP-OS-02]
size: L
milestone: M1
---

# WP-OS-03 — pey LIVE: cliente, verificación, sondeo y barrido por intento

## Goal

In a LIVE deployment, a cobro creates a real pey payment link, and a real payment is found by polling and by the per-intento sweep, verified and released — without a webhook.

## Files it may touch

- `packages/engine/src/pey/cliente.ts`, `packages/engine/src/pey/esquemas.ts`, `packages/engine/src/index.ts`
- `convex/motor/peyPuerto.ts` (replace the LIVE seam), `convex/motor/verificar.ts` (add the sondeo tick), `convex/motor/barrido.ts`, `convex/motor/cuenta.ts`
- `convex/http.ts` (the `/volver` route only), `convex/crons.ts` (add the sweep and the daily account check)
- `convex/puertos.ts` (`credencialPey`, `urlsRetorno` for LIVE)
- `convex/publico.ts` (`vigilar` starts the tick chain)
- `tests/pey/**`, `tests/motor/sondeo.test.ts`, `tests/motor/barrido.test.ts`, `tests/motor/volver.test.ts`
- `tests/pey/formas/*.json` (recorded shapes built from the OpenAPI examples)
- `CONTEXT.md` §6 only to add or correct a tagged pey fact learned here

## Files it must not touch

`app/**`, `components/**`, `lib/**`, `e2e/**`, `packages/engine/src/estados.ts`, `packages/engine/src/verificacion.ts` (if the policy needs a change, say so in the PR), `packages/engine/src/webhook.ts`, root config, `docs/**`.

## Steps

1. `pey/esquemas.ts`: runtime validators for the responses we read (create link, get link, get transaction, list transactions, get bank account, error body). Unknown `status` values fail validation; they are never mapped to paid. Use hand-written guards or the validator library already in the lockfile; do not add a dependency without the note `AGENTS.md` §1 asks for.
2. `pey/cliente.ts`: `crearClientePey({ apiKey, bankAccountId, fetch, modo })` → `PeyPuerto`.
   - Throws `MODO_INVALIDO` unless `modo === "live"`.
   - Host fixed to `https://api.pey.mx`; paths are constants; ids are validated before being put in a path; `redirect: "error"`; 10 s timeout via `AbortController`; `Authorization: Bearer` set in one place; nothing logs headers or bodies.
   - `crearLink`: body per §6.2 (`hasTip: false`, `clientReferenceId`, metadata with ids only). 2xx → `creado` only if `url` matches `^https://app\.mipey\.mx/payment-link/[0-9A-Z]{26}$` and its id equals `id`; otherwise `incierto`. 4xx → `rechazado` with `errorType` and `requestId`. Timeout, network error, 5xx → `incierto`.
   - `crearQr`: implemented and unit-tested, refuses `montoCentavos < 1` and `expiraSeg < 360`; not wired to any UI in M1.
   - Reads: `leerLink`, `leerTransaccion`, `listarTransaccionesQr`, `listarTransacciones`, `leerCuenta` (returns `codiStatus` only; `clabe` and `name` are dropped before the function returns).
   - GETs retry at most twice on 5xx/timeout with jitter. POSTs never retry.
3. `convex/puertos.ts` LIVE: `credencialPey` reads `PEY_API_KEY` and `PEY_BANK_ACCOUNT_ID`; missing → `ConvexError CUENTA_NO_ACTIVA` with a Spanish message (this is also how "remove the key to stop charging" behaves). `urlsRetorno` builds `https://<CONVEX_SITE_URL>/volver?c=cob_…` for both URLs.
4. `convex/http.ts`: `GET /volver`. Validates `c` as a `cob_` id; unknown → the same neutral page. With `PAYVRO_PUBLIC_URL` → 302 to `${PAYVRO_PUBLIC_URL}/pagar/{c}`; without → minimal HTML in Spanish, no scripts, `Cache-Control: no-store`. Records an `evento` (`origen: retorno`) and schedules `verificarIntento`. Changes no state itself.
5. Sondeo in `convex/motor/verificar.ts`: `publico.vigilar` sets `vigiladoHasta = now + 30 s` and, if `sondeoActivo` is false, sets it and schedules `tick`. `tick` (internal action): stop if heartbeat stale, cobro not `esperando_pago`, or 15 min since start; else read the link, read each listed transaction, call `aplicarEvidencia(…, "sondeo")`, reschedule in 1.5–2 s. Back off 2 → 4 → 8 … 30 s on 429/5xx. Unchanged results bump `sondeos` and `ultimaVerificacionEn` only; a changed or failed read writes a `pey.llamada` entry.
6. `convex/motor/barrido.ts` + cron every minute (LIVE only): for each intento `creado` whose `ultimaVerificacionEn` is older than 45 s, run `verificarIntento(…, "barrido")`, at most 20 per run, oldest first. Also verifies `descartado` intentos of cobros created in the last 24 h (a link cannot be cancelled).
7. `convex/motor/cuenta.ts`: `comprobarCuenta` internal action (`leerCuenta` → store `cuentaLista` and the time on the negocio row); run at first LIVE use and daily. `cobros.crear` in LIVE refuses with `CUENTA_NO_ACTIVA` when the last check is not `ACTIVE`.
8. Tests (no network; `fetch` is a fake). Each seen failing first:
   - Contract: for each recorded shape in `tests/pey/formas/`, the client returns the expected typed value. Shapes come from the OpenAPI examples with CLABE `000000000000000000` and no person's name.
   - Request: the POST body for a 14900-centavo cobro has `amount: 149`, `hasTip: false`, the `int_` reference, HTTPS return URLs, and no extra field.
   - Outcomes: 200 valid → `creado`; 200 with a URL on another host → `incierto`; 400 → `rechazado`; 500, abort and thrown fetch → `incierto`; in all `incierto` cases the fake saw exactly one POST.
   - SSRF: an id containing `/`, `?`, `#`, `..` or `@` is rejected before any request.
   - Mode: constructing the client with `modo: "demo"` throws.
   - Redaction: a `leerCuenta` response containing a CLABE-shaped value yields an object without it; a thrown error's message never contains the API key (use a sentinel key in the test).
   - Sondeo: heartbeat fresh + link paid on the third read → released; heartbeat stale → chain stops and `sondeoActivo` is false; two `vigilar` calls → one chain; 429 → interval doubles.
   - Barrido: an unwatched paid intento is released within one cron run; a paid `descartado` intento sends its cobro to `en_revision` or releases it per §5.1.
   - `/volver`: for an unpaid cobro the state stays `esperando_pago`; redirect target is only ever `PAYVRO_PUBLIC_URL`; `?c=` garbage → neutral page.
   - Missing key: `cobros.crear` in LIVE without `PEY_API_KEY` → `CUENTA_NO_ACTIVA`, no intento reserved.

## Done criterion

Observable
- All tests above pass without network access.
- In a LIVE dev deployment that has **no** pey variables, `cobros.crear` fails with `CUENTA_NO_ACTIVA` and a readable Spanish message.
- `convex/motor/peyPuerto.ts` has no `NO_IMPLEMENTADO` left.
- The real $0.01 charge is **not** part of this package (WP-OS-06, with the founder). Do not call `api.pey.mx` from this package.

Commands that must pass
```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run gate
grep -rn "NO_IMPLEMENTADO" convex packages | wc -l        # prints 0
grep -rlE "api\.pey\.mx" --include=*.ts app components lib convex packages   # prints exactly: packages/engine/src/pey/cliente.ts
```

In the PR: the failing assertion seen per test group; one mutation check (make a 500 on `crearLink` retry once → show the test that fails → revert).

## Out of scope

Webhook route, listing sweep with a cursor, CoDi QR in the UI, push CoDi, real network calls, deploy.

## Risks

- The real response shapes may differ from the OpenAPI examples. Validation fails closed: the cobro stays `esperando_pago` and the bitácora records `pey.llamada` with `resultado: forma_inesperada`. WP-OS-06 captures the real shapes; fix the schemas then, in a follow-up PR.
- pey rate limits are unknown. Keep the interval and the back-off as constants at the top of `verificar.ts` so they can change in one line.
- A long tick chain is many scheduled functions. Keep the 15-minute cap and the single-chain guard; test that a crashed tick does not leave `sondeoActivo` stuck (reset it when `vigiladoHasta` is stale).
- `CONVEX_SITE_URL` naming: confirm in the Convex docs how an HTTP action learns its own site URL; do not hard-code a deployment name.
