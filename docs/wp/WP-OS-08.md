---
id: WP-OS-08
title: Cola de revisión, expiración, cancelación y pausa de cobros
lane: sol
reviewers: [opus, gemini]
depends_on: [WP-OS-03]
size: M
milestone: M2
---

# WP-OS-08 — Cola de revisión, expiración, cancelación y pausa

## Goal

The owner can see every cobro that did not release by itself, understand why in plain Spanish, close it with a recorded decision, cancel a pending cobro, and pause all charging with one switch.

**Blocked on a founders' decision** (`PLAN.md`, open question 7): may the owner release a cobro in `en_revision` manually, or only dismiss it? Build the "dismiss" path first; add "liberar manualmente" only if the answer is yes.

## Files it may touch

- `packages/engine/src/estados.ts` (new transitions out of `en_revision`), `tests/estados.test.ts`
- `convex/motor/revision.ts`, `convex/motor/cobros.ts` (pause guard, cancel), `convex/revision.ts` (public wrappers), `convex/negocio.ts` (`pausarCobros`)
- `app/panel/revision/**`, `app/panel/cobros/[publicId]/**`, `app/panel/ajustes/**`, `components/**`, `lib/estados.ts`
- `tests/motor/revision.test.ts`, `e2e/revision.spec.ts`
- `ARCHITECTURE.md` §5.1 and §8 (the new transitions and functions, in the same PR), `CONTEXT.md` §5

## Files it must not touch

`packages/engine/src/verificacion.ts`, `convex/motor/verificar.ts`, `packages/engine/src/pey/**`.

## Steps

1. Transitions: `en_revision → cerrado_sin_liberar` (owner dismisses; reason required) and, if approved, `en_revision → liberado` with `liberacion: "manual"` (owner only; reason required, 10–280 chars). Add both to the table and the diagram. `cerrado_sin_liberar` is terminal.
2. `revision.resolver({publicId, decision, motivo, claveIdempotencia})`: owner identity required (`actor.tipo === "dueno"`; an agent token is refused even if it could read the cobro). Writes `cobro.revision_resuelta` with the decision and the reason. A manual release shows everywhere as "Liberado manualmente", never as "Pago verificado".
3. `/panel/revision`: list of `en_revision` cobros and of `liberado` cobros with `alerta`. Each row explains the reason: "Pagaron $430.00 y el cobro era de $450.00", "Llegaron dos pagos para este cobro", "Pagaron con tarjeta", "El pago llegó después de que el cobro expiró". Amounts come from the pago rows.
4. Cancel: button on a `borrador`/`esperando_pago` cobro with the warning "El link de pey no se puede cancelar. Si tu cliente paga después, el cobro pasará a En revisión."
5. Pause: `negocio.pausarCobros({pausado})` and a switch in Ajustes. While paused, `cobros.crear` and `cobros.reintentar` throw `COBROS_PAUSADOS`; verification of existing cobros continues. Bitácora `cobros.pausados`.
6. Tests, each seen failing first: resolve requires a reason; resolve twice with one key → one entry; an `agente` actor is refused; manual release is impossible from any state but `en_revision`; a paused negocio cannot create but still releases a cobro paid before the pause; cancel then late payment → `en_revision` with `pago_tardio`; E2E in DEMO: simulate `monto_distinto` → row appears in Revisión with the amounts → dismiss → gone from the queue.

## Done criterion

Observable: in DEMO, each `demo.simularPago` variant other than `exacto` produces a row in `/panel/revision` with a correct Spanish explanation, and resolving it leaves a bitácora entry with the reason.

Commands that must pass
```bash
npm run gate
npx playwright test e2e/revision.spec.ts
```

## Out of scope

Refunds (pey has none), contacting the payer, automatic resolution rules, multi-user approval.

## Risks

- Manual release is the one path that bypasses "paid means pey said so". If it ships, it must be owner-only, reasoned, logged and visually distinct; the reviewer checks each of the four.
- The explanations show money: build them from stored centavos, never from pey text.
