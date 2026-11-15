# os02b2 — medición del gate

## Estado

Toolchain instalado desde el lockfile con Node 24. El codegen oficial **no regeneró** `convex/_generated/api.d.ts`: el push al backend anónimo local se rechaza por un índice reservado. Se midieron los comandos del gate sin corregir `convex/**` ni `packages/**`.

HEAD: `0d42c1edd7235690092764b15e53e33991a2724f` — `chore: regenera convex/_generated (os02b2)`.

## Decisiones

- Este encargo no pide tests nuevos ni una implementación. No hubo ciclo rojo/verde. La medición es el entregable.
- `npm ci --no-audit --no-fund` con Node v24.22.2 / npm 11.19.1. Exit 0. 419 paquetes. SHA-256 de `package-lock.json` y `package.json` idénticos antes y después (`0a82988078bc9d9cf3a0c4103a099e50c087b974579bfe842dbbe84e3422b63a` y `e3a640524a849d576ffd31fbcbd419f147ba4148c840c3441053301b465ecbcc`). `git diff origin/main -- package-lock.json package.json` vacío. No se corrió `npm install <pkg>`.
- Aviso de npm, no es un fallo: peer de `eslint@10.15.0` contra plugins de `eslint-config-next` que piden eslint 9, y el postinstall de `esbuild@0.27.0` no está en `allowScripts`. El binario `node_modules/esbuild/bin/esbuild` sí está. Vitest y `next build` compilaron.
- `npx convex codegen` a secas salió 1: `No CONVEX_DEPLOYMENT set`. Se usó `CONVEX_AGENT_MODE=anonymous npx convex dev --once --typecheck disable --tail-logs disable` (backend local en `http://127.0.0.1:3212`, sin cuenta, sin `--prod`, sin deploy a la nube). Escribió `.env.local` (gitignored; no se commitea ni se pegan valores).
- El push local exigió `CLERK_JWT_ISSUER_DOMAIN` porque `convex/auth.config.ts` lo lee. Se fijó solo en el backend anónimo el placeholder `https://placeholder.invalid`. No es un issuer real y no está en git.
- El segundo push salió 1: `IndexNameReserved` en la tabla `simPayables`, índice `by_id` (`convex/motor/tablas.ts:99`). Convex no deja índices llamados `by_id`, `by_creation_time` ni que empiecen con `_`. Sin un `start_push` exitoso, el CLI no reescribe `api.d.ts`.
- No se usó `convex codegen --system-udfs`. Ese camino legacy reescribe `api.js` sin `componentsGeneric()` y se aparta del codegen por componentes que usa `convex dev`.
- El único diff del codegen es el encabezado nuevo de `convex/_generated/api.js` (el stub `anyApi`). `api.d.ts` sigue importando solo `cobros`, `demo`, `negocio`, `panel`, `publico`. Faltan `motor/*`, `puertos`, `crons` y lo demás.
- Se borró `.convex/` después del codegen. No queda carpeta.
- `lint-canon.sh pvos-os02b` sale 11 por código del builder anterior, no por este diff. No se corrigió: este encargo prohíbe editar `packages/engine` y `convex/motor`.
  - R2: `packages/engine/src/pey/simulador.ts:17` `crearSimulador` 63 líneas.
  - R6: `convex/motor/purga.ts` `.paginate()` dentro de un bucle (líneas 33, 38, 43, 48, 53, 58, 63).
- `.review/` está en `.gitignore`. Este archivo se force-add para que la medición quede en el mismo sitio que `.review/os02b-resultado.md`. No cambia fuente.

## Comandos

Node en el PATH de la medición: v24.22.2. Binarios presentes: `node_modules/.bin/convex`, `node_modules/.bin/vitest`.

| Comando | Exit |
|---|---:|
| `npm ci --no-audit --no-fund` | 0 |
| `CONVEX_AGENT_MODE=anonymous npx convex codegen` | 1 |
| `CONVEX_AGENT_MODE=anonymous npx convex dev --once --typecheck disable --tail-logs disable` | 1 |
| `npx convex codegen --typecheck disable` (con deployment local) | 1 |
| `npm run typecheck` | 2 |
| `npm run lint` | 0 |
| `npm test` | 0 |
| `npm run build` | 1 |
| `npm run e2e` | 1 |
| `npm run gate` | 2 |

`npm run gate` (`scripts/gate.sh`) para en el primer fallo (`typecheck`). No llegó a lint, test, build, e2e ni secrets. Esos se corrieron aparte, en ese orden, antes del gate. `e2e` no instaló Playwright ni lanzó tests: `next build` muere en el typecheck de TypeScript (compiló en Turbopack, luego `Failed to type check`).

## Fallos agrupados por archivo

44 errores de `tsc`, los mismos en `typecheck`, `build` y el typecheck interno de `e2e`/`gate`. Cero errores en `packages/engine` (el `tsc` del engine pasa; el de `convex/tsconfig.json` es el que sale 2). ESLint limpio. Vitest: 6 archivos, 47 tests, exit 0. Esa suite no cubre el motor de Convex.

Causa que hay que desbloquear primero, si no el API generado sigue viejo:

- `convex/motor/tablas.ts` — índice `by_id` en `simPayables` (línea 99). Nombre reservado. Lo usan `convex/motor/peyPuerto.ts` líneas 27, 90 y 112 (`withIndex("by_id")`, TS2345: el campo `"id"` no es asignable a `never`). Renombrar el índice, luego repetir el codegen anónimo. Hasta entonces `internal` en `api.d.ts` no incluye `motor` ni `puertos`.

`internal` tipado como `{}` (módulos ausentes en `api.d.ts`):

- `convex/demo.ts:26` — `internal.motor` no existe.
- `convex/motor/cobros.ts:89,179,216` — `internal.motor`.
- `convex/motor/intentos.ts:107,121,142,161,165,172,175` — `internal.motor`; `:141` — `internal.puertos`.
- `convex/motor/peyPuerto.ts:150,158,161,163,169,193,199` — `internal.motor`; `:192` — `internal.puertos`.
- `convex/puertos.ts:86` — `internal.puertos`.

`ctx.db.get` no estrecha a la tabla (el resultado es la unión de todos los documentos; `modo`, `nombre`, `seqBitacora`, etc. no existen en esa unión). Puede ser cascada del schema que no typechequea por `by_id`. Remedir después del codegen antes de perseguir cada `get`:

- `convex/negocio.ts:19,23,24,25,39`
- `convex/motor/bitacora.ts:88,91`
- `convex/motor/cobros.ts:47,62,67,164,165`
- `convex/cobros.ts:100,102` — `verificadoHoyDia`, `verificadoHoyCentavos`, `enRevisionCount`
- `convex/puertos.ts:76` — `ctx.db.get(id)` con `Id<"negocios">` no asigna a un documento de `negocios` (TS2322)

Validador de retorno, independiente del API generado:

- `convex/cobros.ts:68` TS2719 — `pago.resultado` sale como `string`. En `convex/motor/tablas.ts` el campo `pagos.resultado` es `v.string()`, y el `returns` de `cobros.obtener` exige la unión de literales (`coincide`, `monto_distinto`, …).

## Colas

### `npm run typecheck`

Exit 2. Log de 77 líneas; últimas 40:

```
convex/motor/cobros.ts(179,44): error TS2339: Property 'motor' does not exist on type '{}'.
convex/motor/cobros.ts(216,48): error TS2339: Property 'motor' does not exist on type '{}'.
convex/motor/intentos.ts(107,51): error TS2339: Property 'motor' does not exist on type '{}'.
convex/motor/intentos.ts(121,55): error TS2339: Property 'motor' does not exist on type '{}'.
convex/motor/intentos.ts(141,57): error TS2339: Property 'puertos' does not exist on type '{}'.
convex/motor/intentos.ts(142,52): error TS2339: Property 'motor' does not exist on type '{}'.
convex/motor/intentos.ts(161,38): error TS2339: Property 'motor' does not exist on type '{}'.
convex/motor/intentos.ts(165,38): error TS2339: Property 'motor' does not exist on type '{}'.
convex/motor/intentos.ts(172,38): error TS2339: Property 'motor' does not exist on type '{}'.
convex/motor/intentos.ts(175,36): error TS2339: Property 'motor' does not exist on type '{}'.
convex/motor/peyPuerto.ts(27,82): error TS2345: Argument of type '"id"' is not assignable to parameter of type 'never'.
convex/motor/peyPuerto.ts(90,87): error TS2345: Argument of type '"id"' is not assignable to parameter of type 'never'.
convex/motor/peyPuerto.ts(112,86): error TS2345: Argument of type '"id"' is not assignable to parameter of type 'never'.
convex/motor/peyPuerto.ts(150,48): error TS2339: Property 'motor' does not exist on type '{}'.
convex/motor/peyPuerto.ts(158,47): error TS2339: Property 'motor' does not exist on type '{}'.
convex/motor/peyPuerto.ts(161,66): error TS2339: Property 'motor' does not exist on type '{}'.
convex/motor/peyPuerto.ts(163,83): error TS2339: Property 'motor' does not exist on type '{}'.
convex/motor/peyPuerto.ts(169,50): error TS2339: Property 'motor' does not exist on type '{}'.
convex/motor/peyPuerto.ts(192,57): error TS2339: Property 'puertos' does not exist on type '{}'.
convex/motor/peyPuerto.ts(193,47): error TS2339: Property 'motor' does not exist on type '{}'.
convex/motor/peyPuerto.ts(199,41): error TS2339: Property 'motor' does not exist on type '{}'.
convex/negocio.ts(19,29): error TS2339: Property 'modo' does not exist on type '{ _id: Id<"negocios">; _creationTime: number; ultimoTxVisto?: string | undefined; enRevisionCount?: number | undefined; verificadoHoyDia?: number | undefined; verificadoHoyCentavos?: number | undefined; ... 7 more ...; seqBitacora: number; } | ... 7 more ... | { ...; }'.
  Property 'modo' does not exist on type '{ _id: Id<"demoLimits">; _creationTime: number; clave: string; inicio: number; cantidad: number; }'.
convex/negocio.ts(23,23): error TS2339: Property 'nombre' does not exist on type '{ _id: Id<"negocios">; _creationTime: number; ultimoTxVisto?: string | undefined; enRevisionCount?: number | undefined; verificadoHoyDia?: number | undefined; verificadoHoyCentavos?: number | undefined; ... 7 more ...; seqBitacora: number; } | ... 7 more ... | { ...; }'.
  Property 'nombre' does not exist on type '{ _id: Id<"intentos">; _creationTime: number; peyPayableId?: string | undefined; urlPago?: string | undefined; qrString?: string | undefined; vigiladoHasta?: number | undefined; ... 14 more ...; sondeos: number; }'.
convex/negocio.ts(23,45): error TS2339: Property 'giro' does not exist on type '{ _id: Id<"negocios">; _creationTime: number; ultimoTxVisto?: string | undefined; enRevisionCount?: number | undefined; verificadoHoyDia?: number | undefined; verificadoHoyCentavos?: number | undefined; ... 7 more ...; seqBitacora: number; } | ... 7 more ... | { ...; }'.
  Property 'giro' does not exist on type '{ _id: Id<"intentos">; _creationTime: number; peyPayableId?: string | undefined; urlPago?: string | undefined; qrString?: string | undefined; vigiladoHasta?: number | undefined; ... 14 more ...; sondeos: number; }'.
convex/negocio.ts(24,27): error TS2339: Property 'colorMarca' does not exist on type '{ _id: Id<"negocios">; _creationTime: number; ultimoTxVisto?: string | undefined; enRevisionCount?: number | undefined; verificadoHoyDia?: number | undefined; verificadoHoyCentavos?: number | undefined; ... 7 more ...; seqBitacora: number; } | ... 7 more ... | { ...; }'.
  Property 'colorMarca' does not exist on type '{ _id: Id<"intentos">; _creationTime: number; peyPayableId?: string | undefined; urlPago?: string | undefined; qrString?: string | undefined; vigiladoHasta?: number | undefined; ... 14 more ...; sondeos: number; }'.
convex/negocio.ts(25,21): error TS2339: Property 'modo' does not exist on type '{ _id: Id<"negocios">; _creationTime: number; ultimoTxVisto?: string | undefined; enRevisionCount?: number | undefined; verificadoHoyDia?: number | undefined; verificadoHoyCentavos?: number | undefined; ... 7 more ...; seqBitacora: number; } | ... 7 more ... | { ...; }'.
  Property 'modo' does not exist on type '{ _id: Id<"demoLimits">; _creationTime: number; clave: string; inicio: number; cantidad: number; }'.
convex/negocio.ts(25,51): error TS2339: Property 'cobrosPausados' does not exist on type '{ _id: Id<"negocios">; _creationTime: number; ultimoTxVisto?: string | undefined; enRevisionCount?: number | undefined; verificadoHoyDia?: number | undefined; verificadoHoyCentavos?: number | undefined; ... 7 more ...; seqBitacora: number; } | ... 7 more ... | { ...; }'.
  Property 'cobrosPausados' does not exist on type '{ _id: Id<"intentos">; _creationTime: number; peyPayableId?: string | undefined; urlPago?: string | undefined; qrString?: string | undefined; vigiladoHasta?: number | undefined; ... 14 more ...; sondeos: number; }'.
convex/negocio.ts(25,88): error TS2339: Property 'modo' does not exist on type '{ _id: Id<"negocios">; _creationTime: number; ultimoTxVisto?: string | undefined; enRevisionCount?: number | undefined; verificadoHoyDia?: number | undefined; verificadoHoyCentavos?: number | undefined; ... 7 more ...; seqBitacora: number; } | ... 7 more ... | { ...; }'.
  Property 'modo' does not exist on type '{ _id: Id<"demoLimits">; _creationTime: number; clave: string; inicio: number; cantidad: number; }'.
convex/negocio.ts(39,29): error TS2339: Property 'modo' does not exist on type '{ _id: Id<"negocios">; _creationTime: number; ultimoTxVisto?: string | undefined; enRevisionCount?: number | undefined; verificadoHoyDia?: number | undefined; verificadoHoyCentavos?: number | undefined; ... 7 more ...; seqBitacora: number; } | ... 7 more ... | { ...; }'.
  Property 'modo' does not exist on type '{ _id: Id<"demoLimits">; _creationTime: number; clave: string; inicio: number; cantidad: number; }'.
convex/puertos.ts(76,5): error TS2322: Type '{ _id: Id<"negocios">; _creationTime: number; ultimoTxVisto?: string | undefined; enRevisionCount?: number | undefined; verificadoHoyDia?: number | undefined; verificadoHoyCentavos?: number | undefined; ... 7 more ...; seqBitacora: number; } | ... 8 more ... | null' is not assignable to type '{ _id: Id<"negocios">; _creationTime: number; ultimoTxVisto?: string | undefined; enRevisionCount?: number | undefined; verificadoHoyDia?: number | undefined; verificadoHoyCentavos?: number | undefined; ... 7 more ...; seqBitacora: number; } | null'.
  Type '{ _id: Id<"intentos">; _creationTime: number; peyPayableId?: string | undefined; urlPago?: string | undefined; qrString?: string | undefined; vigiladoHasta?: number | undefined; ... 14 more ...; sondeos: number; }' is missing the following properties from type '{ _id: Id<"negocios">; _creationTime: number; ultimoTxVisto?: string | undefined; enRevisionCount?: number | undefined; verificadoHoyDia?: number | undefined; verificadoHoyCentavos?: number | undefined; ... 7 more ...; seqBitacora: number; }': nombre, giro, colorMarca, cobrosPausados, and 2 more.
convex/puertos.ts(86,54): error TS2339: Property 'puertos' does not exist on type '{}'.
```

### `npm run lint`

Exit 0. Log de 4 líneas; últimas 4:

```

> payvro-os@0.1.0 lint
> eslint .

```

### `npm run test`

Exit 0. Log de 16 líneas; últimas 16:

```

> payvro-os@0.1.0 test
> vitest run


 RUN  v5.1.0 /home/agent-runner/workspaces/repos/pvos-os02b


 Test Files  6 passed (6)
      Tests  47 passed (47)
   Start at  03:20:39
   Duration  2.49s (tests 78%, transform 14%, import 7%, worker 1%)

    Isolate  6 workers spawned · ~144ms startup each (spawn + environment, per file)
             at least ~288ms faster with isolate: false — reuses workers across files instead of one per file

```

### `npm run build`

Exit 1. Log de 86 líneas; últimas 40:

```
convex/motor/intentos.ts(107,51): error TS2339: Property 'motor' does not exist on type '{}'.
convex/motor/intentos.ts(121,55): error TS2339: Property 'motor' does not exist on type '{}'.
convex/motor/intentos.ts(141,57): error TS2339: Property 'puertos' does not exist on type '{}'.
convex/motor/intentos.ts(142,52): error TS2339: Property 'motor' does not exist on type '{}'.
convex/motor/intentos.ts(161,38): error TS2339: Property 'motor' does not exist on type '{}'.
convex/motor/intentos.ts(165,38): error TS2339: Property 'motor' does not exist on type '{}'.
convex/motor/intentos.ts(172,38): error TS2339: Property 'motor' does not exist on type '{}'.
convex/motor/intentos.ts(175,36): error TS2339: Property 'motor' does not exist on type '{}'.
convex/motor/peyPuerto.ts(27,82): error TS2345: Argument of type '"id"' is not assignable to parameter of type 'never'.
convex/motor/peyPuerto.ts(90,87): error TS2345: Argument of type '"id"' is not assignable to parameter of type 'never'.
convex/motor/peyPuerto.ts(112,86): error TS2345: Argument of type '"id"' is not assignable to parameter of type 'never'.
convex/motor/peyPuerto.ts(150,48): error TS2339: Property 'motor' does not exist on type '{}'.
convex/motor/peyPuerto.ts(158,47): error TS2339: Property 'motor' does not exist on type '{}'.
convex/motor/peyPuerto.ts(161,66): error TS2339: Property 'motor' does not exist on type '{}'.
convex/motor/peyPuerto.ts(163,83): error TS2339: Property 'motor' does not exist on type '{}'.
convex/motor/peyPuerto.ts(169,50): error TS2339: Property 'motor' does not exist on type '{}'.
convex/motor/peyPuerto.ts(192,57): error TS2339: Property 'puertos' does not exist on type '{}'.
convex/motor/peyPuerto.ts(193,47): error TS2339: Property 'motor' does not exist on type '{}'.
convex/motor/peyPuerto.ts(199,41): error TS2339: Property 'motor' does not exist on type '{}'.
convex/negocio.ts(19,29): error TS2339: Property 'modo' does not exist on type '{ _id: Id<"negocios">; _creationTime: number; ultimoTxVisto?: string | undefined; enRevisionCount?: number | undefined; verificadoHoyDia?: number | undefined; verificadoHoyCentavos?: number | undefined; ... 7 more ...; seqBitacora: number; } | ... 7 more ... | { ...; }'.
  Property 'modo' does not exist on type '{ _id: Id<"demoLimits">; _creationTime: number; clave: string; inicio: number; cantidad: number; }'.
convex/negocio.ts(23,23): error TS2339: Property 'nombre' does not exist on type '{ _id: Id<"negocios">; _creationTime: number; ultimoTxVisto?: string | undefined; enRevisionCount?: number | undefined; verificadoHoyDia?: number | undefined; verificadoHoyCentavos?: number | undefined; ... 7 more ...; seqBitacora: number; } | ... 7 more ... | { ...; }'.
  Property 'nombre' does not exist on type '{ _id: Id<"intentos">; _creationTime: number; peyPayableId?: string | undefined; urlPago?: string | undefined; qrString?: string | undefined; vigiladoHasta?: number | undefined; ... 14 more ...; sondeos: number; }'.
convex/negocio.ts(23,45): error TS2339: Property 'giro' does not exist on type '{ _id: Id<"negocios">; _creationTime: number; ultimoTxVisto?: string | undefined; enRevisionCount?: number | undefined; verificadoHoyDia?: number | undefined; verificadoHoyCentavos?: number | undefined; ... 7 more ...; seqBitacora: number; } | ... 7 more ... | { ...; }'.
  Property 'giro' does not exist on type '{ _id: Id<"intentos">; _creationTime: number; peyPayableId?: string | undefined; urlPago?: string | undefined; qrString?: string | undefined; vigiladoHasta?: number | undefined; ... 14 more ...; sondeos: number; }'.
convex/negocio.ts(24,27): error TS2339: Property 'colorMarca' does not exist on type '{ _id: Id<"negocios">; _creationTime: number; ultimoTxVisto?: string | undefined; enRevisionCount?: number | undefined; verificadoHoyDia?: number | undefined; verificadoHoyCentavos?: number | undefined; ... 7 more ...; seqBitacora: number; } | ... 7 more ... | { ...; }'.
  Property 'colorMarca' does not exist on type '{ _id: Id<"intentos">; _creationTime: number; peyPayableId?: string | undefined; urlPago?: string | undefined; qrString?: string | undefined; vigiladoHasta?: number | undefined; ... 14 more ...; sondeos: number; }'.
convex/negocio.ts(25,21): error TS2339: Property 'modo' does not exist on type '{ _id: Id<"negocios">; _creationTime: number; ultimoTxVisto?: string | undefined; enRevisionCount?: number | undefined; verificadoHoyDia?: number | undefined; verificadoHoyCentavos?: number | undefined; ... 7 more ...; seqBitacora: number; } | ... 7 more ... | { ...; }'.
  Property 'modo' does not exist on type '{ _id: Id<"demoLimits">; _creationTime: number; clave: string; inicio: number; cantidad: number; }'.
convex/negocio.ts(25,51): error TS2339: Property 'cobrosPausados' does not exist on type '{ _id: Id<"negocios">; _creationTime: number; ultimoTxVisto?: string | undefined; enRevisionCount?: number | undefined; verificadoHoyDia?: number | undefined; verificadoHoyCentavos?: number | undefined; ... 7 more ...; seqBitacora: number; } | ... 7 more ... | { ...; }'.
  Property 'cobrosPausados' does not exist on type '{ _id: Id<"intentos">; _creationTime: number; peyPayableId?: string | undefined; urlPago?: string | undefined; qrString?: string | undefined; vigiladoHasta?: number | undefined; ... 14 more ...; sondeos: number; }'.
convex/negocio.ts(25,88): error TS2339: Property 'modo' does not exist on type '{ _id: Id<"negocios">; _creationTime: number; ultimoTxVisto?: string | undefined; enRevisionCount?: number | undefined; verificadoHoyDia?: number | undefined; verificadoHoyCentavos?: number | undefined; ... 7 more ...; seqBitacora: number; } | ... 7 more ... | { ...; }'.
  Property 'modo' does not exist on type '{ _id: Id<"demoLimits">; _creationTime: number; clave: string; inicio: number; cantidad: number; }'.
convex/negocio.ts(39,29): error TS2339: Property 'modo' does not exist on type '{ _id: Id<"negocios">; _creationTime: number; ultimoTxVisto?: string | undefined; enRevisionCount?: number | undefined; verificadoHoyDia?: number | undefined; verificadoHoyCentavos?: number | undefined; ... 7 more ...; seqBitacora: number; } | ... 7 more ... | { ...; }'.
  Property 'modo' does not exist on type '{ _id: Id<"demoLimits">; _creationTime: number; clave: string; inicio: number; cantidad: number; }'.
convex/puertos.ts(76,5): error TS2322: Type '{ _id: Id<"negocios">; _creationTime: number; ultimoTxVisto?: string | undefined; enRevisionCount?: number | undefined; verificadoHoyDia?: number | undefined; verificadoHoyCentavos?: number | undefined; ... 7 more ...; seqBitacora: number; } | ... 8 more ... | null' is not assignable to type '{ _id: Id<"negocios">; _creationTime: number; ultimoTxVisto?: string | undefined; enRevisionCount?: number | undefined; verificadoHoyDia?: number | undefined; verificadoHoyCentavos?: number | undefined; ... 7 more ...; seqBitacora: number; } | null'.
  Type '{ _id: Id<"intentos">; _creationTime: number; peyPayableId?: string | undefined; urlPago?: string | undefined; qrString?: string | undefined; vigiladoHasta?: number | undefined; ... 14 more ...; sondeos: number; }' is missing the following properties from type '{ _id: Id<"negocios">; _creationTime: number; ultimoTxVisto?: string | undefined; enRevisionCount?: number | undefined; verificadoHoyDia?: number | undefined; verificadoHoyCentavos?: number | undefined; ... 7 more ...; seqBitacora: number; }': nombre, giro, colorMarca, cobrosPausados, and 2 more.
convex/puertos.ts(86,54): error TS2339: Property 'puertos' does not exist on type '{}'.
Failed to type check.

```

### `npm run e2e`

Exit 1. Log de 90 líneas; últimas 40:

```
convex/motor/intentos.ts(107,51): error TS2339: Property 'motor' does not exist on type '{}'.
convex/motor/intentos.ts(121,55): error TS2339: Property 'motor' does not exist on type '{}'.
convex/motor/intentos.ts(141,57): error TS2339: Property 'puertos' does not exist on type '{}'.
convex/motor/intentos.ts(142,52): error TS2339: Property 'motor' does not exist on type '{}'.
convex/motor/intentos.ts(161,38): error TS2339: Property 'motor' does not exist on type '{}'.
convex/motor/intentos.ts(165,38): error TS2339: Property 'motor' does not exist on type '{}'.
convex/motor/intentos.ts(172,38): error TS2339: Property 'motor' does not exist on type '{}'.
convex/motor/intentos.ts(175,36): error TS2339: Property 'motor' does not exist on type '{}'.
convex/motor/peyPuerto.ts(27,82): error TS2345: Argument of type '"id"' is not assignable to parameter of type 'never'.
convex/motor/peyPuerto.ts(90,87): error TS2345: Argument of type '"id"' is not assignable to parameter of type 'never'.
convex/motor/peyPuerto.ts(112,86): error TS2345: Argument of type '"id"' is not assignable to parameter of type 'never'.
convex/motor/peyPuerto.ts(150,48): error TS2339: Property 'motor' does not exist on type '{}'.
convex/motor/peyPuerto.ts(158,47): error TS2339: Property 'motor' does not exist on type '{}'.
convex/motor/peyPuerto.ts(161,66): error TS2339: Property 'motor' does not exist on type '{}'.
convex/motor/peyPuerto.ts(163,83): error TS2339: Property 'motor' does not exist on type '{}'.
convex/motor/peyPuerto.ts(169,50): error TS2339: Property 'motor' does not exist on type '{}'.
convex/motor/peyPuerto.ts(192,57): error TS2339: Property 'puertos' does not exist on type '{}'.
convex/motor/peyPuerto.ts(193,47): error TS2339: Property 'motor' does not exist on type '{}'.
convex/motor/peyPuerto.ts(199,41): error TS2339: Property 'motor' does not exist on type '{}'.
convex/negocio.ts(19,29): error TS2339: Property 'modo' does not exist on type '{ _id: Id<"negocios">; _creationTime: number; ultimoTxVisto?: string | undefined; enRevisionCount?: number | undefined; verificadoHoyDia?: number | undefined; verificadoHoyCentavos?: number | undefined; ... 7 more ...; seqBitacora: number; } | ... 7 more ... | { ...; }'.
  Property 'modo' does not exist on type '{ _id: Id<"demoLimits">; _creationTime: number; clave: string; inicio: number; cantidad: number; }'.
convex/negocio.ts(23,23): error TS2339: Property 'nombre' does not exist on type '{ _id: Id<"negocios">; _creationTime: number; ultimoTxVisto?: string | undefined; enRevisionCount?: number | undefined; verificadoHoyDia?: number | undefined; verificadoHoyCentavos?: number | undefined; ... 7 more ...; seqBitacora: number; } | ... 7 more ... | { ...; }'.
  Property 'nombre' does not exist on type '{ _id: Id<"intentos">; _creationTime: number; peyPayableId?: string | undefined; urlPago?: string | undefined; qrString?: string | undefined; vigiladoHasta?: number | undefined; ... 14 more ...; sondeos: number; }'.
convex/negocio.ts(23,45): error TS2339: Property 'giro' does not exist on type '{ _id: Id<"negocios">; _creationTime: number; ultimoTxVisto?: string | undefined; enRevisionCount?: number | undefined; verificadoHoyDia?: number | undefined; verificadoHoyCentavos?: number | undefined; ... 7 more ...; seqBitacora: number; } | ... 7 more ... | { ...; }'.
  Property 'giro' does not exist on type '{ _id: Id<"intentos">; _creationTime: number; peyPayableId?: string | undefined; urlPago?: string | undefined; qrString?: string | undefined; vigiladoHasta?: number | undefined; ... 14 more ...; sondeos: number; }'.
convex/negocio.ts(24,27): error TS2339: Property 'colorMarca' does not exist on type '{ _id: Id<"negocios">; _creationTime: number; ultimoTxVisto?: string | undefined; enRevisionCount?: number | undefined; verificadoHoyDia?: number | undefined; verificadoHoyCentavos?: number | undefined; ... 7 more ...; seqBitacora: number; } | ... 7 more ... | { ...; }'.
  Property 'colorMarca' does not exist on type '{ _id: Id<"intentos">; _creationTime: number; peyPayableId?: string | undefined; urlPago?: string | undefined; qrString?: string | undefined; vigiladoHasta?: number | undefined; ... 14 more ...; sondeos: number; }'.
convex/negocio.ts(25,21): error TS2339: Property 'modo' does not exist on type '{ _id: Id<"negocios">; _creationTime: number; ultimoTxVisto?: string | undefined; enRevisionCount?: number | undefined; verificadoHoyDia?: number | undefined; verificadoHoyCentavos?: number | undefined; ... 7 more ...; seqBitacora: number; } | ... 7 more ... | { ...; }'.
  Property 'modo' does not exist on type '{ _id: Id<"demoLimits">; _creationTime: number; clave: string; inicio: number; cantidad: number; }'.
convex/negocio.ts(25,51): error TS2339: Property 'cobrosPausados' does not exist on type '{ _id: Id<"negocios">; _creationTime: number; ultimoTxVisto?: string | undefined; enRevisionCount?: number | undefined; verificadoHoyDia?: number | undefined; verificadoHoyCentavos?: number | undefined; ... 7 more ...; seqBitacora: number; } | ... 7 more ... | { ...; }'.
  Property 'cobrosPausados' does not exist on type '{ _id: Id<"intentos">; _creationTime: number; peyPayableId?: string | undefined; urlPago?: string | undefined; qrString?: string | undefined; vigiladoHasta?: number | undefined; ... 14 more ...; sondeos: number; }'.
convex/negocio.ts(25,88): error TS2339: Property 'modo' does not exist on type '{ _id: Id<"negocios">; _creationTime: number; ultimoTxVisto?: string | undefined; enRevisionCount?: number | undefined; verificadoHoyDia?: number | undefined; verificadoHoyCentavos?: number | undefined; ... 7 more ...; seqBitacora: number; } | ... 7 more ... | { ...; }'.
  Property 'modo' does not exist on type '{ _id: Id<"demoLimits">; _creationTime: number; clave: string; inicio: number; cantidad: number; }'.
convex/negocio.ts(39,29): error TS2339: Property 'modo' does not exist on type '{ _id: Id<"negocios">; _creationTime: number; ultimoTxVisto?: string | undefined; enRevisionCount?: number | undefined; verificadoHoyDia?: number | undefined; verificadoHoyCentavos?: number | undefined; ... 7 more ...; seqBitacora: number; } | ... 7 more ... | { ...; }'.
  Property 'modo' does not exist on type '{ _id: Id<"demoLimits">; _creationTime: number; clave: string; inicio: number; cantidad: number; }'.
convex/puertos.ts(76,5): error TS2322: Type '{ _id: Id<"negocios">; _creationTime: number; ultimoTxVisto?: string | undefined; enRevisionCount?: number | undefined; verificadoHoyDia?: number | undefined; verificadoHoyCentavos?: number | undefined; ... 7 more ...; seqBitacora: number; } | ... 8 more ... | null' is not assignable to type '{ _id: Id<"negocios">; _creationTime: number; ultimoTxVisto?: string | undefined; enRevisionCount?: number | undefined; verificadoHoyDia?: number | undefined; verificadoHoyCentavos?: number | undefined; ... 7 more ...; seqBitacora: number; } | null'.
  Type '{ _id: Id<"intentos">; _creationTime: number; peyPayableId?: string | undefined; urlPago?: string | undefined; qrString?: string | undefined; vigiladoHasta?: number | undefined; ... 14 more ...; sondeos: number; }' is missing the following properties from type '{ _id: Id<"negocios">; _creationTime: number; ultimoTxVisto?: string | undefined; enRevisionCount?: number | undefined; verificadoHoyDia?: number | undefined; verificadoHoyCentavos?: number | undefined; ... 7 more ...; seqBitacora: number; }': nombre, giro, colorMarca, cobrosPausados, and 2 more.
convex/puertos.ts(86,54): error TS2339: Property 'puertos' does not exist on type '{}'.
Failed to type check.

```

### `npm run gate`

Exit 2. Log de 81 líneas; últimas 40:

```
convex/motor/cobros.ts(179,44): error TS2339: Property 'motor' does not exist on type '{}'.
convex/motor/cobros.ts(216,48): error TS2339: Property 'motor' does not exist on type '{}'.
convex/motor/intentos.ts(107,51): error TS2339: Property 'motor' does not exist on type '{}'.
convex/motor/intentos.ts(121,55): error TS2339: Property 'motor' does not exist on type '{}'.
convex/motor/intentos.ts(141,57): error TS2339: Property 'puertos' does not exist on type '{}'.
convex/motor/intentos.ts(142,52): error TS2339: Property 'motor' does not exist on type '{}'.
convex/motor/intentos.ts(161,38): error TS2339: Property 'motor' does not exist on type '{}'.
convex/motor/intentos.ts(165,38): error TS2339: Property 'motor' does not exist on type '{}'.
convex/motor/intentos.ts(172,38): error TS2339: Property 'motor' does not exist on type '{}'.
convex/motor/intentos.ts(175,36): error TS2339: Property 'motor' does not exist on type '{}'.
convex/motor/peyPuerto.ts(27,82): error TS2345: Argument of type '"id"' is not assignable to parameter of type 'never'.
convex/motor/peyPuerto.ts(90,87): error TS2345: Argument of type '"id"' is not assignable to parameter of type 'never'.
convex/motor/peyPuerto.ts(112,86): error TS2345: Argument of type '"id"' is not assignable to parameter of type 'never'.
convex/motor/peyPuerto.ts(150,48): error TS2339: Property 'motor' does not exist on type '{}'.
convex/motor/peyPuerto.ts(158,47): error TS2339: Property 'motor' does not exist on type '{}'.
convex/motor/peyPuerto.ts(161,66): error TS2339: Property 'motor' does not exist on type '{}'.
convex/motor/peyPuerto.ts(163,83): error TS2339: Property 'motor' does not exist on type '{}'.
convex/motor/peyPuerto.ts(169,50): error TS2339: Property 'motor' does not exist on type '{}'.
convex/motor/peyPuerto.ts(192,57): error TS2339: Property 'puertos' does not exist on type '{}'.
convex/motor/peyPuerto.ts(193,47): error TS2339: Property 'motor' does not exist on type '{}'.
convex/motor/peyPuerto.ts(199,41): error TS2339: Property 'motor' does not exist on type '{}'.
convex/negocio.ts(19,29): error TS2339: Property 'modo' does not exist on type '{ _id: Id<"negocios">; _creationTime: number; ultimoTxVisto?: string | undefined; enRevisionCount?: number | undefined; verificadoHoyDia?: number | undefined; verificadoHoyCentavos?: number | undefined; ... 7 more ...; seqBitacora: number; } | ... 7 more ... | { ...; }'.
  Property 'modo' does not exist on type '{ _id: Id<"demoLimits">; _creationTime: number; clave: string; inicio: number; cantidad: number; }'.
convex/negocio.ts(23,23): error TS2339: Property 'nombre' does not exist on type '{ _id: Id<"negocios">; _creationTime: number; ultimoTxVisto?: string | undefined; enRevisionCount?: number | undefined; verificadoHoyDia?: number | undefined; verificadoHoyCentavos?: number | undefined; ... 7 more ...; seqBitacora: number; } | ... 7 more ... | { ...; }'.
  Property 'nombre' does not exist on type '{ _id: Id<"intentos">; _creationTime: number; peyPayableId?: string | undefined; urlPago?: string | undefined; qrString?: string | undefined; vigiladoHasta?: number | undefined; ... 14 more ...; sondeos: number; }'.
convex/negocio.ts(23,45): error TS2339: Property 'giro' does not exist on type '{ _id: Id<"negocios">; _creationTime: number; ultimoTxVisto?: string | undefined; enRevisionCount?: number | undefined; verificadoHoyDia?: number | undefined; verificadoHoyCentavos?: number | undefined; ... 7 more ...; seqBitacora: number; } | ... 7 more ... | { ...; }'.
  Property 'giro' does not exist on type '{ _id: Id<"intentos">; _creationTime: number; peyPayableId?: string | undefined; urlPago?: string | undefined; qrString?: string | undefined; vigiladoHasta?: number | undefined; ... 14 more ...; sondeos: number; }'.
convex/negocio.ts(24,27): error TS2339: Property 'colorMarca' does not exist on type '{ _id: Id<"negocios">; _creationTime: number; ultimoTxVisto?: string | undefined; enRevisionCount?: number | undefined; verificadoHoyDia?: number | undefined; verificadoHoyCentavos?: number | undefined; ... 7 more ...; seqBitacora: number; } | ... 7 more ... | { ...; }'.
  Property 'colorMarca' does not exist on type '{ _id: Id<"intentos">; _creationTime: number; peyPayableId?: string | undefined; urlPago?: string | undefined; qrString?: string | undefined; vigiladoHasta?: number | undefined; ... 14 more ...; sondeos: number; }'.
convex/negocio.ts(25,21): error TS2339: Property 'modo' does not exist on type '{ _id: Id<"negocios">; _creationTime: number; ultimoTxVisto?: string | undefined; enRevisionCount?: number | undefined; verificadoHoyDia?: number | undefined; verificadoHoyCentavos?: number | undefined; ... 7 more ...; seqBitacora: number; } | ... 7 more ... | { ...; }'.
  Property 'modo' does not exist on type '{ _id: Id<"demoLimits">; _creationTime: number; clave: string; inicio: number; cantidad: number; }'.
convex/negocio.ts(25,51): error TS2339: Property 'cobrosPausados' does not exist on type '{ _id: Id<"negocios">; _creationTime: number; ultimoTxVisto?: string | undefined; enRevisionCount?: number | undefined; verificadoHoyDia?: number | undefined; verificadoHoyCentavos?: number | undefined; ... 7 more ...; seqBitacora: number; } | ... 7 more ... | { ...; }'.
  Property 'cobrosPausados' does not exist on type '{ _id: Id<"intentos">; _creationTime: number; peyPayableId?: string | undefined; urlPago?: string | undefined; qrString?: string | undefined; vigiladoHasta?: number | undefined; ... 14 more ...; sondeos: number; }'.
convex/negocio.ts(25,88): error TS2339: Property 'modo' does not exist on type '{ _id: Id<"negocios">; _creationTime: number; ultimoTxVisto?: string | undefined; enRevisionCount?: number | undefined; verificadoHoyDia?: number | undefined; verificadoHoyCentavos?: number | undefined; ... 7 more ...; seqBitacora: number; } | ... 7 more ... | { ...; }'.
  Property 'modo' does not exist on type '{ _id: Id<"demoLimits">; _creationTime: number; clave: string; inicio: number; cantidad: number; }'.
convex/negocio.ts(39,29): error TS2339: Property 'modo' does not exist on type '{ _id: Id<"negocios">; _creationTime: number; ultimoTxVisto?: string | undefined; enRevisionCount?: number | undefined; verificadoHoyDia?: number | undefined; verificadoHoyCentavos?: number | undefined; ... 7 more ...; seqBitacora: number; } | ... 7 more ... | { ...; }'.
  Property 'modo' does not exist on type '{ _id: Id<"demoLimits">; _creationTime: number; clave: string; inicio: number; cantidad: number; }'.
convex/puertos.ts(76,5): error TS2322: Type '{ _id: Id<"negocios">; _creationTime: number; ultimoTxVisto?: string | undefined; enRevisionCount?: number | undefined; verificadoHoyDia?: number | undefined; verificadoHoyCentavos?: number | undefined; ... 7 more ...; seqBitacora: number; } | ... 8 more ... | null' is not assignable to type '{ _id: Id<"negocios">; _creationTime: number; ultimoTxVisto?: string | undefined; enRevisionCount?: number | undefined; verificadoHoyDia?: number | undefined; verificadoHoyCentavos?: number | undefined; ... 7 more ...; seqBitacora: number; } | null'.
  Type '{ _id: Id<"intentos">; _creationTime: number; peyPayableId?: string | undefined; urlPago?: string | undefined; qrString?: string | undefined; vigiladoHasta?: number | undefined; ... 14 more ...; sondeos: number; }' is missing the following properties from type '{ _id: Id<"negocios">; _creationTime: number; ultimoTxVisto?: string | undefined; enRevisionCount?: number | undefined; verificadoHoyDia?: number | undefined; verificadoHoyCentavos?: number | undefined; ... 7 more ...; seqBitacora: number; }': nombre, giro, colorMarca, cobrosPausados, and 2 more.
convex/puertos.ts(86,54): error TS2339: Property 'puertos' does not exist on type '{}'.
```

## Qué queda para el siguiente builder

1. Renombrar `simPayables.by_id` y actualizar los `withIndex` de `peyPuerto.ts`.
2. Regenerar `convex/_generated` con backend anónimo (no nube, no `--prod`) hasta que `api.d.ts` liste `motor` y `puertos`.
3. Volver a correr `npm run typecheck`. Si los `db.get` siguen anchos, el id que llega a `get` no es `Id<"negocios">`.
4. Ajustar `pagos.resultado` al contrato del `returns` de `cobros.obtener`, o al revés, sin ensanchar el validador público a `string`.
5. `lint-canon` R2 (`crearSimulador`) y R6 (`purga.ts`) siguen abiertos en esta rama.
