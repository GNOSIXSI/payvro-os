---
id: WP-OS-04
title: Página de pago y panel "Pedido que se libera"
lane: cursor-grok
reviewers: [sonnet, gemini]
depends_on: [WP-OS-01]
size: L
milestone: M1
---

# WP-OS-04 — Página de pago y panel "Pedido que se libera"

## Goal

The screens of the approved prototype for the first template: the owner creates a charge and watches its state; the payer sees what they owe, pays, and sees "Pago verificado" — all reading the Convex functions of `ARCHITECTURE.md` §8.

## Files it may touch

- `app/pagar/[publicId]/**`
- `app/panel/**` (`layout.tsx`, `page.tsx`, `nuevo/page.tsx`, `cobros/[publicId]/page.tsx`, `ajustes/page.tsx`)
- `components/**` (new product components; shadcn primitives may be added under `components/ui/`)
- `lib/formato.ts`, `lib/estados.ts`, `lib/clave.ts`
- `e2e/pantallas.spec.ts`
- `tests/lib/**`
- `package.json` + `package-lock.json` only to add a QR rendering library (one, small, no network); say which and why in the PR

## Files it must not touch

`convex/**`, `packages/**`, `app/layout.tsx`, `app/providers.tsx`, `app/page.tsx`, `app/globals.css` (tokens are already there; if one is missing, list it in the PR), `public/brand/**`, root config, `docs/**`, the root docs.

## Reference

The approved presentation is the source for these screens: slide 6 (clickable prototype, screens 4–6) and slide 7 (panel). Match its structure, copy and chip styles. Do not add screens it does not have. Tokens and rules: `ARCHITECTURE.md` §9. State labels and chip colors: `CONTEXT.md` §5.

## Steps

1. `lib/formato.ts`: `formatoMXN(centavos)` with `Intl.NumberFormat("es-MX", {style:"currency", currency:"MXN"})`; `pesosACentavos(texto)` that parses what a person types (`"450"`, `"450.5"`, `"0.01"`, `"1,340.00"`) into integer centavos **using string arithmetic, not floats**, and returns an error for anything else (more than two decimals, negative, zero, empty). `lib/estados.ts`: map each cobro state to `{etiqueta, chip}` for owner and for payer. `lib/clave.ts`: `nuevaClave()` → a `claveIdempotencia` from `crypto.randomUUID()`, created once per form mount and reused on retry.
2. Components: `ChipEstado` (text always present; a dot plus label; colors from `CONTEXT.md` §5), `EtiquetaDemo`, `Monto`, `TarjetaResumen`, `TablaCobros`, `LineaDeTiempo`, `QrCodi`, `BotonCopiar`.
3. `/panel` — `cobros.resumenDelDia()` in three tiles: "Cobrado hoy", "Por liberar", "En revisión"; `cobros.listar()` in a table: Cobro (`#folio`), Concepto, Monto (right aligned), Estado (chip). Empty state: "Aún no tienes cobros. Crea el primero." with the button "Nuevo cobro". On mobile the table becomes a list. Side navigation shows only "Cobros" and "Ajustes" (the other entries of the mock belong to Cloud).
4. `/panel/nuevo` — fields "Concepto" (≤ 140) and "Monto". Submit calls `cobros.crear({claveIdempotencia, concepto, montoCentavos})`. Disable the button while pending; on error show `mensaje` from the `ConvexError`. After success go to the detail.
5. `/panel/cobros/[publicId]` — `cobros.obtener`. Shows folio, concept, amount, chip. While the intento is being created: "Creando el QR CoDi…". When ready: "Mostrar QR" (native CoDi QR from `qrString`, fixed amount, 24-hour expiration, caption "Escanea con la app de tu banco para pagar con CoDi"). Offer "Pagar con link" only after the QR intento is terminal or expired; when available it copies the PAYVRO payer URL on HTTPS or `urlPago` otherwise. Include a disabled "Enviar por WhatsApp" with the note "Disponible en PAYVRO Cloud (plan Pro)". Timeline from `panel.bitacora({cobroPublicId})`: Cobro creado · Pago verificado · Liberado, each with its time. `en_revision` shows the reason in plain Spanish and "No se liberó automáticamente." Calls `publico.vigilar` every 10 s while the cobro is `esperando_pago` and the tab is visible.
6. `/panel/ajustes` — `negocio.obtener` / `negocio.actualizarPerfil`: Nombre (≤ 40), Giro (six options from the prototype), Color (four swatches with `aria-pressed`). Read-only block: "Modo: DEMO | LIVE" and "Cuenta en pey: lista | en validación". No key, no account id, no CLABE field anywhere.
7. `/pagar/[publicId]` — `publico.cobro`. Header in the business color with its name; amount large; `#folio` and concept; native CoDi QR from `qrString` (fixed amount, 24-hour expiration); optional "Pagar con link" → `urlPago` only when the QR intento is terminal or expired; caption "Escanea con la app de tu banco para pagar. El dinero va directo a {nombre}."; chip with the payer-facing label. States: `null` → "Este cobro no existe o ya no está disponible."; verified/released → the check mark, "Pago verificado" and "{nombre} ya recibió tu pago."; `en_revision` → "Estamos revisando tu pago. {nombre} te contactará."; expired/cancelled → "Este cobro ya no está disponible." In DEMO: the `DEMO` tag and a button "Simular pago" → `demo.simularPago({publicId, variante: "exacto"})`, label "Verificando con pey…" while pending. Calls `publico.vigilar` every 10 s while waiting and visible. No Clerk on this route.
8. Accessibility and feel: every interactive element ≥ 44 px; visible focus ring; labels tied to inputs; `aria-live="polite"` on the state region; contrast AA on the business color header (white text on the four allowed colors); transitions ≤ 200 ms ease-out and none under `prefers-reduced-motion`; the amount never wraps.
9. Tests, each seen failing first:
   - `tests/lib/formato.test.ts`: `pesosACentavos("0.01")` → 1; `"450"` → 45000; `"1,340.00"` → 134000; `"0.1"` → 10; rejects `"1.234"`, `"-5"`, `"0"`, `""`, `"abc"`, `"1e3"`. `formatoMXN(134000)` → `$1,340.00`.
   - `tests/lib/estados.test.ts`: every state has a non-empty label for owner and payer; the amber chip is used by `esperando_pago` only.
   - `e2e/pantallas.spec.ts` (DEMO, against the stubs until WP-OS-02 merges, then against the engine): `/panel` shows the three tiles and a row per fixture state with its text label; `/pagar/<fixture id>` shows the business name, the amount and "Esperando pago"; `/pagar/cob_noexiste` shows the not-available message; the `DEMO` tag is visible on both routes; no element on `/pagar` matches `/CLABE|llave|api key/i`.

## Done criterion

Observable
- At 375 px and at 1280 px wide: `/panel`, `/panel/nuevo`, `/panel/cobros/<id>`, `/panel/ajustes`, `/pagar/<id>` render without horizontal scroll and match the prototype's structure. Attach one screenshot per route and width to the PR (fixture data only).
- Every state in `CONTEXT.md` §5 is reachable on screen with its exact Spanish label.
- Keyboard only: create a charge and copy its link without a mouse.

Commands that must pass
```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run e2e
npm run gate
grep -rnE "PEY_|bankAccount|clabe" app components lib | wc -l   # prints 0
```

In the PR: the failing assertion seen for each test file; the screenshots; the name and size of the QR library added.

## Out of scope

Landing or marketing sections, sign-in/sign-up screens (WP-OS-06 adds the Clerk route with the default component), onboarding wizard (Cloud), push CoDi, WhatsApp, the full happy-path E2E with a simulated payment (WP-OS-05), notifications, exports, dark mode.

## Risks

- You are building against stubs: mutations throw `NO_IMPLEMENTADO` until WP-OS-02 lands. Handle that error like any other (show the message); do not mock around it in product code.
- Do not import anything from `packages/engine/src/pey` or reach for an environment variable to know the mode: it comes from `negocio.obtener()` / `publico.cobro()`.
- If the budget ends before the Done criterion is met, push what exists, list what is missing in the PR, and stop. `sol` continues from this same file.
- Parsing money from text is where float bugs enter. Keep `pesosACentavos` string-based and covered.
