---
id: WP-OS-07
title: "Timbre y barrido por listado: webhook firmado y cursor de transacciones"
lane: astra
reviewers: [opus, gemini]
depends_on: [WP-OS-03]
size: M
milestone: M2
---

# WP-OS-07 — Timbre y barrido por listado

## Goal

A signed pey webhook triggers a verification within seconds, and a sweep over pey's transaction listing recovers any payment whose webhook never arrived and whose cobro nobody is watching.

## Files it may touch

- `packages/engine/src/webhook.ts`, `packages/engine/src/index.ts`
- `convex/http.ts` (add `POST /webhooks/pey`), `convex/motor/eventos.ts`, `convex/motor/barrido.ts`, `convex/crons.ts`
- `convex/puertos.ts` (`credencialPey` returns `webhookSecret`)
- `tests/webhook.test.ts`, `tests/motor/eventos.test.ts`, `tests/motor/barrido-listado.test.ts`, `tests/pey/formas/webhook-*.json`
- `CONTEXT.md` §6 (webhook facts), `INSTALL.md` §6

## Files it must not touch

`app/**`, `components/**`, `packages/engine/src/verificacion.ts`, `packages/engine/src/estados.ts`, `convex/motor/verificar.ts` except to call it.

## Steps

1. Read docs.pey.mx for the current webhook section: event names, payload fields, headers, how an endpoint is registered. Record what you find in `CONTEXT.md` §6 as `[FACT]` with the date, replacing the `[NOTE]` lines. If the docs contradict Standard Webhooks, stop and report.
2. `webhook.ts`: `verificarWebhook({cuerpoCrudo, cabeceras, secreto, ahoraSeg})` → `{ok: true, id, timestamp}` or `{ok: false, motivo}`. Standard Webhooks: secret is base64 after the `whsec_` prefix; signed content `${id}.${timestamp}.${body}`; HMAC-SHA256; header `webhook-signature` is a space-separated list of `v1,<base64>`; accept if any matches, compared in constant time; timestamp within ±300 s; `webhook-id` ≤ 200 chars. WebCrypto only. Verify before parsing JSON.
3. `POST /webhooks/pey`: 503 without a secret; 413 over 256 KiB (check `content-length`, then enforce while reading); 401 on any verification failure with an empty body; on success call `motor.eventos.registrar` and answer 200 `{}`.
4. `convex/motor/eventos.ts`: `registrar` inserts an `eventosPey` row keyed by `webhookId` (duplicate → acknowledge, do nothing else), stores `tipo` if allowlisted (else `tipo: "otro"`), the hint ids and `hashCuerpo`; if a hint matches an intento, schedule `verificarIntento(…, "webhook")`. It never reads an amount or a status from the payload.
5. Listing sweep in `barrido.ts`: page `listarTransacciones()` newest first until reaching `negocio.ultimoTxVisto` or 5 pages; for each `PAID` item whose `payableId` matches an intento → `verificarIntento`; for items naming an unknown or `descartado` intento via metadata → per §5.2; unmatched → one `evento.recibido` with `resultado: sin_cobro`, no state change. Then advance `ultimoTxVisto`. For QR intentos also check presence in `GET /transaction/bank-account/{id}` (§6.3).
6. Tests, each seen failing first:
   - Signature: valid passes; then alter one byte of the body, add trailing whitespace, change the id, change the timestamp, use a 6-minute-old timestamp, use another secret, send two signatures where the second is valid (passes), send `v2,` only (fails).
   - Route: no secret → 503; oversize → 413 and nothing stored; invalid → 401 and nothing stored; valid → 200 and one evento.
   - Replay: the same valid event 50 times concurrently → one evento, one verification effect.
   - Authority: a valid, signed event claiming `status: paid` for an unpaid link (the port still says `pending`) leaves the cobro `esperando_pago`.
   - Lost webhook: a paid, unwatched link with no event → released by the listing sweep in one run.
   - Cursor: the sweep stops at `ultimoTxVisto`; a second run with nothing new makes one request.
   - Foreign transaction: a paid transaction of the same key with no PAYVRO metadata is logged once and changes nothing.

## Done criterion

Observable: with a locally signed fixture event, `curl` to the dev deployment's `/webhooks/pey` returns 200 and the bitácora shows `evento.recibido`; the same request with one changed byte returns 401.

Commands that must pass
```bash
npm run gate
npx vitest run tests/webhook.test.ts tests/motor/eventos.test.ts tests/motor/barrido-listado.test.ts
```

Registering the endpoint in pey for the LIVE deployment is a founder action, after merge; record it in `docs/despliegue.md`.

## Out of scope

Bank-account-updated events, outbound webhooks to the business's systems, retries toward pey (there are none to do).

## Risks

- The webhook facts in `CONTEXT.md` are from notes, not from the spec. Step 1 comes first for that reason.
- A leaked webhook secret must not be able to release anything: the authority test above is the one that proves it. Do not weaken it.
- Listing 80 transactions per page per minute per business is cheap for one business; Cloud will need the cursor to be efficient (do not page from the start each run).
