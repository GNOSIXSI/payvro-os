# os02b fix2 — un pago que cierra un link parcial persiste

## Estado

El cobro que ya está en `en_revision` conserva un PAID contado y aún no reclamado. `aplicarEvidencia` lo inserta y reclama en la misma mutación, anota `pago.no_coincide` y no transiciona ni libera. La relectura de la misma evidencia no crea una tercera fila.

Sin push, sin deploy, sin cargo LIVE. Esto es la evidencia del constructor, no un dictamen de revisor ni permiso de merge.

## Commits

- `64992c1` — `test: el pago que cierra un link parcial debe persistir en revisión`
- `ab057dd` — `fix: persistir un pago contado mientras el cobro sigue en revisión`
- Este informe va en un commit aparte, después del DoD.
- Base previa: `724059b` (`docs: record os02b fix1 evidence`). No se reescribió historia.

## Qué cambió

- `convex/motor/verificar.ts`: si el cobro ya está en `en_revision` y el veredicto es `revisar` (cualquier motivo, no solo `parcial`), los PAID nuevos ya insertados se quedan. La bitácora usa `pago.no_coincide` con el motivo del veredicto. No hay `patch` del cobro, no sube `enRevisionCount` y no se llama a `liberar`.
- `tests/motor/demo-flow.test.ts`: el caller de Convex cubre el repro de la revisión y el replay, más un cobro ya en revisión por `monto_distinto`.
- `packages/engine/src/verificacion.ts` y `tests/verificacion.test.ts` no se tocaron. `evaluar` ya devolvía `revisar/duplicado` con dos PAID contados y `link.status === "paid"`. El fallo estaba solo en la rama de `aplicarEvidencia` que exigía `motivo === "parcial"`.

El reclamo global (`CLAVE_REUTILIZADA` si el id ya es de otro cobro), la comparación de monto y la regla de destino siguen en `evaluar` y en el bucle de reclamo de antes. No hubo codegen, ni `.convex/`, ni `.env.local`, ni cambios de lockfile, UI, e2e o docs.

## Rojo, mutación, verde

Antes del fix, `npx vitest run tests/motor/demo-flow.test.ts -t "persists the payment that completes a partial link|persists a new counted payment"`:

```text
Tests  2 failed | 7 skipped (9)
AssertionError: promise rejected "ConvexError: {"codigo":"TRANSICION_INVALIDA"…}" instead of resolving
 ❯ tests/motor/demo-flow.test.ts:267
Caused by: ConvexError: {"codigo":"TRANSICION_INVALIDA","mensaje":"El cobro no admite aplicar esta evidencia."}
 ❯ handler convex/motor/verificar.ts:192
```

El mismo fallo en el segundo test, línea 346, mismo `verificar.ts:192`. La primera llamada (link `partial`, o un solo PAID de monto distinto) sí resolvía; la segunda, con el id nuevo ya en `PAID`, revertía la fila.

Mutación: se restauró la condición vieja `cobro.motivoRevision === "parcial" && veredicto.motivo === "parcial"`. Los dos tests volvieron a rojo con `TRANSICION_INVALIDA` en `verificar.ts:192`. Se restauró la rama nueva. `npx vitest run tests/motor/demo-flow.test.ts -t "persists the payment that completes a partial link|persists a new counted payment|keeps only paid payable"`: 3 passed.

## Decisiones

- No existe `pago.recibido` en la allowlist de `convex/motor/bitacora.ts`. El evento de un pago retenido ya permitido es `pago.no_coincide`. No se amplió la allowlist: ese archivo está fuera del alcance de esta ronda.
- Un veredicto `coincide` con el cobro ya en `en_revision` sigue sin liberar (esa rama exige `esperando_pago`) y sigue lanzando `TRANSICION_INVALIDA`. No es el repro: dos PAID contados no producen `coincide`. Queda como nota, no como bloqueo, igual que el cierre del orquestador sobre variantes posteriores del tema partial.
- El segundo test fija «cualquier motivo de revisión»: si la rama volviera a exigir `motivoRevision === "parcial"`, el cobro en `monto_distinto` seguiría rojo.

## DoD

Node en PATH: `v22.23.4`. No hay Node 24 en esta máquina. Los comandos salieron 0 igual.

| Comando | Exit |
|---|---:|
| `npm run typecheck` | 0 |
| `npm run lint` | 0 |
| `npm test` | 0 |
| `npm run build` | 0 |
| `npm run gate` | 0 |
| `lint-canon.sh pvos-os02b` antes de cada commit | 0 (`LINT_OK`) |

`npm test` (57, antes 55 por los dos tests nuevos):

```text
Test Files  7 passed (7)
     Tests  57 passed (57)
   Duration  2.22s
```

`npm run build`:

```text
✓ Compiled successfully in 3.2s
  Finished TypeScript in 5.2s ...
✓ Generating static pages using 4 workers (3/3) in 617ms
```

`npm run gate` (`scripts/gate.sh`: typecheck, lint, test, build, e2e, secrets), exit 0. Cola:

```text
 Test Files  7 passed (7)
      Tests  57 passed (57)
...
✓ Compiled successfully in 578ms
  Finished TypeScript in 7.0s ...
...
  ✓  1 e2e/humo.spec.ts:3:1 › home presents PAYVRO and the DEMO mode (385ms)
  1 passed (2.0s)
...
5:30AM INF no leaks found
5:30AM INF 123 commits scanned.
5:30AM INF no leaks found
```

`npm run typecheck` y `npm run lint` no imprimen más que el script cuando pasan (`tsc --noEmit` de app, engine y convex; `eslint .`).
