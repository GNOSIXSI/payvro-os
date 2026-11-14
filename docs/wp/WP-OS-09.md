---
id: WP-OS-09
title: "Mostrador: QR CoDi de precio fijo con varios pagos"
lane: sol
reviewers: [sonnet, gemini]
depends_on: [WP-OS-07]
size: L
milestone: M2
---

# WP-OS-09 — Mostrador: QR CoDi de precio fijo

## Goal

A business prints or shows one CoDi QR for a fixed price; every payment of it becomes its own verified, released cobro, and the screen says "Recibiste $X".

## Files it may touch

- `convex/motor/etiquetas.ts`, `convex/motor/tablas.ts` (table `etiquetas`), `convex/motor/barrido.ts` (QR listing), `convex/etiquetas.ts`
- `packages/engine/src/verificacion.ts` (QR evidence path, if not already covered), `tests/verificacion.test.ts`
- `app/panel/mostrador/**`, `components/**`, `lib/**`
- `tests/motor/etiquetas.test.ts`, `e2e/mostrador.spec.ts`
- `ARCHITECTURE.md` (§4 table, §7 flow, §8 functions), `CONTEXT.md` §2 (term **etiqueta**)

## Files it must not touch

`packages/engine/src/estados.ts` unless a new transition is truly needed (say why), `packages/engine/src/pey/cliente.ts` except for a bug.

## Steps

1. Model: an **etiqueta** = `{publicId, nombre, montoCentavos ≥ 1, peyPayableId (IDC), qrString, activa}`. One pey QR, no expiration, `bankAccountId = PEY_BANK_ACCOUNT_ID`, amount fixed. Created with record-before-call exactly like an intento (ADR-0010).
2. Each paid transaction of the QR → one cobro created by the system in `pagado_verificado → liberado`, plantilla `mostrador`, bound to that transaction id (global claim). The cobro is born from evidence; there is no `esperando_pago` phase.
3. Detection: sondeo on the etiqueta while the Mostrador screen is open (`GET /transaction/codi/qr/{id}`, first page, newest first, stop at the last seen id); the sweep covers it otherwise; the webhook `codi.qr.payment_received` is a hint.
4. Destination check: each transaction must also appear in `GET /transaction/bank-account/{PEY_BANK_ACCOUNT_ID}`; absent → cobro `en_revision` (`destino_distinto`).
5. Amount check: `base !== etiqueta.montoCentavos` → `en_revision` (`monto_distinto`). An amount-0 QR cannot be created: validate in the wrapper, in the motor and in the client (three tests).
6. UI `/panel/mostrador`: create etiqueta (name, price); full-screen view with the CoDi QR rendered from `qrString`, the price, "Paga con la app de tu banco (CoDi)"; on each new payment a banner "Recibiste $X" (visual; optional spoken announcement behind a toggle using the browser's speech synthesis, off by default); "Corte del día": count and sum of today's released mostrador cobros.
7. Tests, each seen failing first: amount 0 refused at three layers; three payments of one QR → three cobros, three pagos, no duplicates on replay; wrong amount → `en_revision`; transaction absent from the bank-account listing → `en_revision`; deactivated etiqueta still verifies late payments; E2E in DEMO with the simulator paying the same etiqueta twice.

## Done criterion

Observable: in DEMO, one etiqueta paid twice shows two "Recibiste" banners, two rows in Cobros, and the corte del día sums both.

Commands that must pass
```bash
npm run gate
npx playwright test e2e/mostrador.spec.ts
```

A LIVE check with a $0.01 etiqueta is a founder action after merge.

## Out of scope

Open-amount QR (forbidden), push CoDi, printing layouts, inventory, multiple cash registers.

## Risks

- This is the only place where several payments of one payable are normal. Keep that logic in `etiquetas.ts`; do not relax the duplicate rule for links.
- Polling a busy QR: page from the newest and stop at the last seen id; never re-read the whole history.
- The spoken announcement must never read anything but the amount.
