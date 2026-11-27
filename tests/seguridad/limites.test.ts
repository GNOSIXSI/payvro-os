import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import { nuevoId } from "@payvro/engine/ids";
import { insertarNegocioLive, nuevoLiveHarness, BANK_ID } from "../motor/live-support";

type Harness = ReturnType<typeof nuevoLiveHarness>;
const limitado = /DEMASIADAS_SOLICITUDES/;
const entrada = (n: number) => ({ claveIdempotencia: `crear-ejemplo-${n.toString().padStart(4, "0")}`, concepto: "Pedido de ejemplo", montoCentavos: 100 });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-26T00:00:00Z"));
  vi.stubEnv("PAYVRO_MODE", "demo");
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

async function cobrosDemo(t: Harness, cantidad: number, estado: "borrador" | "esperando_pago") {
  await t.mutation(api.negocio.preparar, {});
  return t.run(async (ctx) => {
    const negocio = await ctx.db.query("negocios").withIndex("by_modo", (q) => q.eq("modo", "demo")).unique();
    if (!negocio) throw new Error("Fixture DEMO sin negocio");
    const ids = [];
    for (let n = 0; n < cantidad; n++) {
      const publicId = nuevoId("cob_");
      const ahora = Date.now();
      const cobroId = await ctx.db.insert("cobros", {
        publicId, modo: "demo", negocioId: negocio._id, folio: n + 1, plantilla: "pedido",
        concepto: "Pedido de ejemplo", montoCentavos: 100, moneda: "MXN", estado,
        expiraEn: ahora + 60_000, claveIdempotencia: `cobro-fixture-${n}`,
        creadoPor: { tipo: "simulador" }, creadoEn: ahora, actualizadoEn: ahora,
      });
      const intentoId = await ctx.db.insert("intentos", {
        publicId: nuevoId("int_"), modo: "demo", negocioId: negocio._id, cobroId,
        montoCentavos: 100, tipo: "qr", estado: estado === "borrador" ? "fallido" : "creado",
        destino: "bank_account_id", claveIdempotencia: `intento-fixture-${n}`,
        sondeoActivo: false, sondeos: 0, creadoEn: ahora,
      });
      await ctx.db.patch(cobroId, { intentoActivoId: intentoId });
      ids.push({ publicId, intentoId });
    }
    return ids;
  });
}

it("exige clasificar toda mutación o acción pública para la cobertura de límites", async () => {
  const modulos = import.meta.glob<Record<string, unknown>>("../../convex/**/*.ts");
  const publicas: string[] = [];
  for (const [ruta, cargar] of Object.entries(modulos)) {
    for (const [nombre, funcion] of Object.entries(await cargar())) {
      if (typeof funcion === "function" && "isPublic" in funcion && funcion.isPublic === true &&
        (("isMutation" in funcion && funcion.isMutation === true) || ("isAction" in funcion && funcion.isAction === true))) {
        publicas.push(`${ruta.slice("../../convex/".length, -3)}:${nombre}`);
      }
    }
  }
  expect(publicas.sort()).toEqual([
    "cobros:cancelar", "cobros:crear", "cobros:reintentar", "demo:simularPago", "negocio:actualizarPerfil",
    // Bootstrap idempotent: creates the DEMO singleton if and only if it is missing.
    "negocio:preparar", "publico:vigilar",
  ]);
});

it("comparte la cuota DEMO entre crear y reintentar, sin cobrar un replay de creación", async () => {
  const t = nuevoLiveHarness();
  const pendientes = await cobrosDemo(t, 7, "borrador");
  const inicial = await t.mutation(api.cobros.crear, entrada(0));
  for (let i = 0; i < 12; i++) await expect(t.mutation(api.cobros.crear, entrada(0))).resolves.toEqual(inicial);
  for (let i = 1; i < 5; i++) await expect(t.mutation(api.cobros.crear, entrada(i))).resolves.toMatchObject({ estado: "borrador" });
  for (let i = 0; i < 5; i++) {
    await expect(t.mutation(api.cobros.reintentar, { publicId: pendientes[i].publicId, claveIdempotencia: `reintento-ejemplo-${i}` })).resolves.toMatchObject({ estado: "reservado" });
  }
  await expect(t.mutation(api.cobros.reintentar, { publicId: pendientes[5].publicId, claveIdempotencia: "reintento-ejemplo-5" })).rejects.toThrow(limitado);
  await expect(t.mutation(api.cobros.crear, entrada(5))).rejects.toThrow(limitado);
  await expect(t.mutation(api.cobros.crear, entrada(0))).resolves.toEqual(inicial);
  await expect(t.mutation(api.cobros.crear, { ...entrada(0), montoCentavos: 101 })).rejects.toThrow(/CLAVE_REUTILIZADA/);
  expect((await t.query(api.cobros.obtener, { publicId: pendientes[5].publicId }))?.intentoActivo?.estado).toBe("fallido");
  vi.setSystemTime(Date.now() + 60_001);
  await expect(t.mutation(api.cobros.reintentar, { publicId: pendientes[5].publicId, claveIdempotencia: "reintento-ejemplo-5" })).resolves.toMatchObject({ estado: "reservado" });
  await expect(t.mutation(api.cobros.crear, entrada(5))).resolves.toMatchObject({ estado: "borrador" });
});

it("aplica la cuota de crear al dueño resuelto, sin compartirla con otro dueño", async () => {
  // Only synthetic identity/DB state; fake timers never run the scheduled action.
  vi.stubEnv("PAYVRO_MODE", "live");
  vi.stubEnv("PAYVRO_OWNER_EMAILS", "a@example.invalid,b@example.invalid");
  vi.stubEnv("PEY_API_KEY", "fixture-not-a-key");
  vi.stubEnv("PEY_BANK_ACCOUNT_ID", BANK_ID);
  const t = nuevoLiveHarness();
  await insertarNegocioLive(t);
  const a = t.withIdentity({ subject: "dueno-a", email: "a@example.invalid", emailVerified: true });
  const b = t.withIdentity({ subject: "dueno-b", email: "b@example.invalid", emailVerified: true });
  for (let i = 0; i < 10; i++) await expect(a.mutation(api.cobros.crear, entrada(i))).resolves.toMatchObject({ estado: "borrador" });
  await expect(a.mutation(api.cobros.crear, entrada(10))).rejects.toThrow(limitado);
  await expect(b.mutation(api.cobros.crear, entrada(10))).resolves.toMatchObject({ estado: "borrador" });
});

it("limita cancelar sin gastar el cupo de creación ni cancelar el excedente", async () => {
  const t = nuevoLiveHarness();
  const cobros = await cobrosDemo(t, 11, "esperando_pago");
  const cancelar = (i: number) => t.mutation(api.cobros.cancelar, { publicId: cobros[i].publicId, claveIdempotencia: `cancelacion-ejemplo-${i}` });
  for (let i = 0; i < 10; i++) await expect(cancelar(i)).resolves.toEqual({ estado: "cancelado" });
  await expect(cancelar(10)).rejects.toThrow(limitado);
  expect((await t.query(api.cobros.obtener, { publicId: cobros[10].publicId }))?.estado).toBe("esperando_pago");
  await expect(t.mutation(api.cobros.crear, entrada(80))).resolves.toMatchObject({ estado: "borrador" });
  vi.setSystemTime(Date.now() + 60_001);
  await expect(cancelar(10)).resolves.toEqual({ estado: "cancelado" });
});

it("limita actualizarPerfil sin cambiar el perfil ni registrar el excedente", async () => {
  const t = nuevoLiveHarness();
  const actualizar = (i: number) => t.mutation(api.negocio.actualizarPerfil, { nombre: `Negocio de ejemplo ${i}`, giro: "social", colorMarca: "#076B76" });
  for (let i = 0; i < 10; i++) await expect(actualizar(i)).resolves.toEqual({ ok: true });
  await expect(actualizar(10)).rejects.toThrow(limitado);
  expect(await t.query(api.negocio.obtener, {})).toMatchObject({ nombre: "Negocio de ejemplo 9" });
  const registro = await t.run(async (ctx) => {
    const negocio = await ctx.db.query("negocios").withIndex("by_modo", (q) => q.eq("modo", "demo")).unique();
    if (!negocio) throw new Error("Fixture DEMO sin negocio");
    return ctx.db.query("bitacora").withIndex("by_negocio_seq", (q) => q.eq("negocioId", negocio._id)).take(11);
  });
  expect(registro.map((entrada) => entrada.tipo)).toEqual(Array(10).fill("negocio.actualizado"));
  vi.setSystemTime(Date.now() + 60_001);
  await expect(actualizar(10)).resolves.toEqual({ ok: true });
});

it("mantiene 60 heartbeats/min por cobro y permite otro cobro", async () => {
  const t = nuevoLiveHarness();
  const [a, b] = await cobrosDemo(t, 2, "esperando_pago");
  for (let i = 0; i < 60; i++) await expect(t.mutation(api.publico.vigilar, { publicId: a.publicId })).resolves.toEqual({ ok: true });
  await expect(t.mutation(api.publico.vigilar, { publicId: a.publicId })).rejects.toThrow(limitado);
  await expect(t.mutation(api.publico.vigilar, { publicId: b.publicId })).resolves.toEqual({ ok: true });
  expect(await t.run(async (ctx) => (await ctx.db.get(b.intentoId))?.vigiladoHasta)).toBeGreaterThanOrEqual(Date.now() + 30_000);
});

it("frena el exceso agregado de heartbeats aunque cada cobro tenga cupo", async () => {
  const t = nuevoLiveHarness();
  const cobros = await cobrosDemo(t, 11, "esperando_pago");
  for (let i = 0; i < 600; i++) await expect(t.mutation(api.publico.vigilar, { publicId: cobros[i % 10].publicId })).resolves.toEqual({ ok: true });
  const { publicId, intentoId } = cobros[10];
  await expect(t.mutation(api.publico.vigilar, { publicId })).rejects.toThrow(limitado);
  expect(await t.run(async (ctx) => (await ctx.db.get(intentoId))?.vigiladoHasta ?? null)).toBeNull();
  vi.setSystemTime(Date.now() + 60_001);
  await expect(t.mutation(api.publico.vigilar, { publicId })).resolves.toEqual({ ok: true });
});

it("conserva 20 simulaciones DEMO/min por negocio, incluso con distintos cobros", async () => {
  const t = nuevoLiveHarness();
  const cobros = await cobrosDemo(t, 21, "esperando_pago");
  const simular = (i: number) => t.mutation(api.demo.simularPago, { publicId: cobros[i].publicId, variante: "exacto" });
  for (let i = 0; i < 20; i++) await expect(simular(i)).resolves.toEqual({ ok: true });
  await expect(simular(20)).rejects.toThrow(limitado);
  vi.setSystemTime(Date.now() + 60_001);
  await expect(simular(20)).resolves.toEqual({ ok: true });
});
