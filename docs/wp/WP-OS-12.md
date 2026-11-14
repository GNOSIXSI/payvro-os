---
id: WP-OS-12
title: Plantillas "Anticipo de cita" y "Cotización que arranca"
lane: sol
reviewers: [sonnet, gemini]
depends_on: [WP-OS-08]
size: L
milestone: M2
---

# WP-OS-12 — Plantillas de cita y de cotización

## Goal

Two more templates over the same engine: a deposit that confirms an appointment (and frees the slot if unpaid in time), and a quote whose acceptance and payment put a job in the queue.

Split into two PRs (12a cita, 12b cotización) if either passes two hours; they share no file but `convex/motor/plantillas.ts`, which 12a creates.

## Files it may touch

- `convex/motor/plantillas.ts`, `convex/motor/tablas.ts` (tables `citas`, `cotizaciones`), `convex/motor/liberar.ts` (dispatch by plantilla)
- `convex/citas.ts`, `convex/cotizaciones.ts`
- `app/panel/citas/**`, `app/panel/cotizaciones/**`, `app/cotizacion/[publicId]/**`, `components/**`, `lib/**`
- `tests/motor/plantillas.test.ts`, `e2e/cita.spec.ts`, `e2e/cotizacion.spec.ts`
- `ARCHITECTURE.md` (§4, §7, §8), `CONTEXT.md` §2

## Files it must not touch

`packages/engine/src/verificacion.ts`, `packages/engine/src/estados.ts`, `convex/motor/verificar.ts`. A template never changes how a payment is verified; it changes what the intención is and what liberación does.

## Steps

1. `plantillas.ts`: a template is `{id, crearIntencion, alLiberar, alExpirar}`. `liberar.ts` calls `alLiberar` inside the release mutation; side effects that need the network are scheduled with the cobro id as idempotency key.
2. **Cita**: `{cuando, duracionMin, clienteNombre?, anticipoCentavos}`. Creating it creates a cobro whose `expiraEn` is the hold deadline (default 30 min, configurable per negocio). `alLiberar` → cita `confirmada`. `alExpirar` → cita `liberada` (the slot is free again). A late payment follows the engine rule (`en_revision`), and the cita stays free. No calendar integration: a simple day list.
3. **Cotización**: `{concepto, totalCentavos, anticipoCentavos, vigenciaHasta}`. Public page `/cotizacion/[publicId]` shows it and a button "Aceptar y pagar anticipo" → creates the cobro (idempotent per quote) → payer page. `alLiberar` → cotización `en_curso`, appears in "Trabajos" with its verified deposit.
4. Customer names typed by the owner are personal data: store only what the template needs, show it only in the panel, never on a public page beyond what the owner typed for that customer.
5. Tests, each seen failing first: cita unpaid at the deadline → slot freed, cobro `expirado`; paid in time → `confirmada` once even if evidence is applied twice; two acceptances of one quote → one cobro; quote past `vigenciaHasta` cannot be accepted; `alLiberar` failure does not undo `liberado` and is retried; E2E in DEMO for each template.

## Done criterion

Observable: in DEMO, both flows end with the template's own object in its released state, and the cobro's bitácora is the same six entries as for a pedido.

Commands that must pass
```bash
npm run gate
npx playwright test e2e/cita.spec.ts e2e/cotizacion.spec.ts
```

## Out of scope

Calendar sync, reminders, WhatsApp, recurring charges (Membresía), partial payments, taxes or invoices.

## Risks

- The temptation to special-case verification per template. Reject it in review.
- Time zones: store epoch ms, render in `America/Mexico_City` unless the negocio says otherwise.
