# os05 release — resultado

HEAD de trabajo: `3aa6da6` (más el commit de este informe). Rama `feat/pv-os05-integracion`. Sin `git push`.

## Conflictos

### `origin/feat/pv-os03b-cableado`

Merge limpio (`1bc7075`, mensaje por defecto de `git merge --no-edit`). No hubo conflictos.

Quedó la prueba de cuenta no concluyente: si el listado de la cuenta trae filas descartadas o ve el id del pago sin `PAID`, `verificarIntento` registra la lectura como fallida y devuelve `diferida` (`convex/motor/verificar.ts`). El lockfile no cambió. `package.json` de os14b no trae `doctor` ni `smoke:demo`; se conservaron los de esta rama.

### `origin/feat/pv-os14b-shell-alta`

Un conflicto, `e2e/shell.spec.ts` (`89ae8ed`).

| Trozo | Resolución |
|---|---|
| Import del rewriter y helpers de la gráfica | Versión os14b: el alta no finge éxito y la suma es por día de creación. |
| Texto de la gráfica | os14b: región «Cobros liberados por día de creación» y prefijo «Suma por día de creación». |
| Lo demás de os14b (Inicio paginado, spec de reactividad en Playwright) | Entró sin conflicto: `lib/paginas-serie.ts`, `e2e/inicio-reactivo.spec.ts`. |

Esta rama ya no tiene `convex/_stub/fixtures.ts` (el motor real sustituyó al stub). El spec de os14b importaba `COBROS_FIXTURE` y no compilaba. Se quitó esa cuenta de fixture; la etiqueta por día de creación se conserva. Los totales del stub los cubre `e2e/inicio-reactivo.spec.ts`.

## Hallazgos

### 1. Pagador bloqueado en LIVE

El bootstrap del dueño envolvía todas las rutas y `negocio.obtener` corre antes de montar la página. En LIVE esa consulta responde `NO_AUTORIZADO`.

Rojo (`npx playwright test e2e/pagar-live.spec.ts --workers=1`), antes del arreglo. El stub contesta `QueryFailed` con `NO_AUTORIZADO` a `negocio.obtener` y el cobro público por el otro lado. La página no mostró `$450.00`. El snapshot era:

```
- alert
- paragraph: No se pudo cargar la cuenta.
```

Verde, el mismo comando, 2/2:

- `/pagar/<id>` muestra monto, «Esperando pago», el QR y el cliente envía `publico:vigilar`, sin llamar `negocio:obtener`.
- `/` muestra el titular y DEMO vía `publico.instalacion`, sin `negocio:obtener`.

Arreglo: `AsegurarNegocio` solo en `app/(dueno)/layout.tsx` (`/panel/**` y `/bienvenida`). `app/providers.tsx` ya no lo monta. La autorización de `negocio.obtener` no se tocó.

`/` no puede aprender el modo con `negocio.obtener`. Se añadió `publico.instalacion`, que solo devuelve el modo de la instalación (`PAYVRO_MODE` en Convex, la misma fuente). No hay `NEXT_PUBLIC_PAYVRO_MODE`.

### 2. Alta inalcanzable

Rojo (`npx vitest run tests/negocio/alta-demo.test.ts`):

```
AssertionError: expected 'Dulces Ana — Ejemplo' to be ''
- Expected
+ Received
+ Dulces Ana — Ejemplo
tests/negocio/alta-demo.test.ts:38  expect(fresco.nombre).toBe("")
```

El bootstrap de escritura (`resolverNegocioEscritura`) insertaba ese nombre, y `AsegurarNegocio` lo volvía a guardar con `actualizarPerfil`. `decidirAlta` daba el alta por terminada.

Verde: el mismo vitest, 1/1. Después `npx playwright test e2e/shell.spec.ts --workers=1`, 7/7, sin reescribir el nombre en el WebSocket. El último caso completa los 3 pasos, exige `negocio:actualizarPerfil` en lo enviado y, tras `sessionStorage.clear()` y recargar, el nombre sigue en el panel.

Arreglo, fuera del alcance escrito porque el nombre no vivía en la UI:

- `convex/puertos.ts`: el negocio DEMO nuevo se inserta con nombre vacío. Giro y color de práctica se quedan; sin ellos la fila no cabe en el esquema.
- `convex/negocio.ts`: `preparar` solo asegura esa fila en DEMO. No cambia la autorización de `obtener`.
- `components/asegurar-negocio.tsx`: ante `NO_ENCONTRADO` llama `preparar`, no `actualizarPerfil`.

`e2e/rewriter-nombre.ts` y su test se eliminaron. El rechazo del perfil sigue en el e2e, pero solo sustituye la respuesta de `actualizarPerfil`; no vacía el nombre. Los demás specs que entran al panel usan `entrarAlPanel` (Omitir en la sesión, sin escribir el nombre en Convex) cuando el negocio todavía no tiene nombre.

### 3. Identidad del camino feliz

`e2e/camino-feliz.spec.ts` guarda el `publicId` de la URL del detalle y el folio (`#N`). El link copiado tiene que ser exactamente `/pagar/` de ese id. En el listado, la fila es la que contiene `a[href="/panel/cobros/<publicId>"]` y debe decir «Liberado» y el folio.

Una corrida aislada ya salió verde: el cobro nuevo sí queda Liberado, así que el selector viejo también habría pasado con una sola fila. El caso del hallazgo es la repetición. Abajo, 3/3 sobre el mismo backend, con cobros Liberados de las vueltas anteriores.

## Decisiones

- Nota de `lib/url-copia.ts`: no se acotó la copia en localhost a DEMO. `destinoDeCopia` no recibe el modo, y el camino feliz DEMO copia el link local cuando no hay `urlPago`. Meter el modo ahí no era uno de los tres hallazgos.
- Avisos de ESLint en `packages/engine/src/pey/cliente.ts` (`_id`, `_nextToken`) llegaron con os03b. El gate sigue en 0; no se tocó el engine para silenciarlos.
- No hubo codegen que cambiara `convex/_generated`: el `api` tipa los módulos con `typeof`. No quedó `.env.local` anónimo.
- Doctor/smoke en la nube y el recorrido de instalación no se midieron.

## DoD

`npm run gate` → exit 0.

```
Test Files  23 passed (23)
     Tests  146 passed (146)

  20 passed (37.3s)

8:16AM INF no leaks found
8:16AM INF 245 commits scanned.
8:16AM INF no leaks found
GATE_EXIT:0
```

Lint del gate: 2 warnings, 0 errors, en `packages/engine/src/pey/cliente.ts` (os03b).

`npx playwright test e2e/camino-feliz.spec.ts --repeat-each=3 --workers=1` → exit 0, 3/3.

```
  ✓  1 e2e/camino-feliz.spec.ts:4:1 › de /panel a Liberado contra el motor, en DEMO (2.1s)
  ✓  2 e2e/camino-feliz.spec.ts:4:1 › de /panel a Liberado contra el motor, en DEMO (2.2s)
  ✓  3 e2e/camino-feliz.spec.ts:4:1 › de /panel a Liberado contra el motor, en DEMO (2.1s)

  3 passed (26.6s)
CAMINO_EXIT:0
```

`lint-canon.sh pvos-os05` antes y después de cada commit de este turno: `LINT_OK`. El único aviso es el `package-lock.json` ya presente frente a `origin/main`.
