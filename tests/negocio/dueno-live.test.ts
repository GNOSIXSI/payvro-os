import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import * as cobros from "../../convex/cobros";
import * as negocio from "../../convex/negocio";
import * as panel from "../../convex/panel";

const correo = "dueno@example.invalid";
const perfil: { nombre: string; giro: "social"; colorMarca: "#076B76" } = { nombre: "Negocio de ejemplo", giro: "social", colorMarca: "#076B76" };
const crear = { concepto: "Pedido de ejemplo", montoCentavos: 100, claveIdempotencia: "pedido-live-000001" };
const publicId = `cob_${"0".repeat(25)}1`;
const paginationOpts = { cursor: null, numItems: 5 };
const modules = import.meta.glob<Record<string, { isInternal?: boolean; isMutation?: boolean }>>("../../convex/**/*.ts");
const instalar = makeFunctionReference<"mutation", typeof perfil, { creado: boolean }>("instalacion:instalarLive");
const harness = () => convexTest(schema, modules);
const autorizado = (t: ReturnType<typeof harness>) => t.withIdentity({ email: correo, emailVerified: true });

beforeEach(() => {
  vi.stubEnv("PAYVRO_MODE", "live");
  vi.stubEnv("PAYVRO_OWNER_EMAILS", correo);
  vi.stubEnv("PEY_API_KEY", undefined);
  vi.stubEnv("PEY_BANK_ACCOUNT_ID", undefined);
});
afterEach(() => vi.unstubAllEnvs());

describe("alta administrativa", () => {
  it("crea un negocio LIVE, no lo reemplaza y no deja reservar sin cuenta lista", async () => {
    const t = harness();
    expect(await t.mutation(instalar, perfil)).toEqual({ creado: true });
    expect(await t.mutation(instalar, { ...perfil, nombre: "Otro perfil de ejemplo" })).toEqual({ creado: false });
    expect(await t.run((ctx) => ctx.db.query("negocios").take(2))).toEqual([
      expect.objectContaining({ ...perfil, modo: "live", folioSiguiente: 1, seqBitacora: 0 }),
    ]);
    const dueno = autorizado(t);
    await expect(dueno.query(api.negocio.obtener, {})).resolves.toMatchObject({ ...perfil, cuentaLista: false });
    await expect(dueno.mutation(api.cobros.crear, crear)).rejects.toMatchObject({ data: { codigo: "CUENTA_NO_ACTIVA" } });
    expect(await t.run(async (ctx) => [await ctx.db.query("cobros").first(), await ctx.db.query("intentos").first()])).toEqual([null, null]);
  });

  it("es una mutación interna, no acepta destino y rechaza nombres inválidos", async () => {
    const t = harness();
    // convex-test can invoke internal functions; registration owns the visibility boundary.
    const registro = (await modules["../../convex/instalacion.ts"]?.())?.instalarLive;
    expect(registro?.isMutation).toBe(true);
    expect(registro?.isInternal).toBe(true);
    await expect(t.mutation(instalar, { ...perfil, nombre: "   " })).rejects.toMatchObject({ data: { codigo: "TRANSICION_INVALIDA" } });
    await expect(t.mutation(instalar, { ...perfil, nombre: "x".repeat(41) })).rejects.toMatchObject({ data: { codigo: "TRANSICION_INVALIDA" } });
    const conDestino = { ...perfil, bankAccountId: "destino-sintetico" };
    await expect(t.mutation(instalar, conDestino)).rejects.toThrow(/bankAccountId/);
    expect(await t.run((ctx) => ctx.db.query("negocios").first())).toBeNull();
  });

  it("no instala fuera de LIVE ni encima de un negocio DEMO", async () => {
    const t = harness();
    vi.stubEnv("PAYVRO_MODE", "demo");
    await expect(t.mutation(instalar, perfil)).rejects.toMatchObject({ data: { codigo: "MODO_INVALIDO" } });
    expect(await t.run((ctx) => ctx.db.query("negocios").first())).toBeNull();
    await t.mutation(api.negocio.preparar, {});
    vi.stubEnv("PAYVRO_MODE", "live");
    await expect(t.mutation(instalar, perfil)).rejects.toMatchObject({ data: { codigo: "MODO_INVALIDO" } });
    expect(await t.run((ctx) => ctx.db.query("negocios").take(2))).toEqual([expect.objectContaining({ modo: "demo" })]);
  });
});

const funciones = {
  cobros: {
    crear: (t) => t.mutation(api.cobros.crear, crear),
    listar: (t) => t.query(api.cobros.listar, { paginationOpts }),
    obtener: (t) => t.query(api.cobros.obtener, { publicId }),
    resumenDelDia: (t) => t.query(api.cobros.resumenDelDia, {}),
    cancelar: (t) => t.mutation(api.cobros.cancelar, { publicId, claveIdempotencia: crear.claveIdempotencia }),
    reintentar: (t) => t.mutation(api.cobros.reintentar, { publicId, claveIdempotencia: crear.claveIdempotencia }),
  },
  negocio: {
    obtener: (t) => t.query(api.negocio.obtener, {}),
    actualizarPerfil: (t) => t.mutation(api.negocio.actualizarPerfil, perfil),
    preparar: (t) => t.mutation(api.negocio.preparar, {}),
  },
  panel: { bitacora: (t) => t.query(api.panel.bitacora, { paginationOpts }) },
} satisfies Record<string, Record<string, (t: ReturnType<typeof harness>) => Promise<unknown>>>;

it("cubre toda la superficie registrada de dueño", () => {
  for (const [modulo, exports] of Object.entries({ cobros, negocio, panel })) {
    const publica = Object.entries(exports).filter(([, valor]) => "isPublic" in valor && valor.isPublic);
    expect(Object.keys(funciones[modulo as keyof typeof funciones]).sort()).toEqual(publica.map(([nombre]) => nombre).sort());
  }
});

it("niega todas las funciones de dueño sin sesión, sin permiso o sin verificación", async () => {
  const t = harness();
  await t.mutation(instalar, perfil);
  const ajeno = t.withIdentity({ email: "visitante@example.invalid", emailVerified: true });
  const noVerificado = t.withIdentity({ email: correo, emailVerified: false });
  for (const [modulo, registro] of Object.entries(funciones)) {
    for (const [nombre, llamar] of Object.entries(registro)) {
      for (const [identidad, cliente] of Object.entries({ anonimo: t, ajeno, noVerificado })) {
        await expect(llamar(cliente), `${modulo}:${nombre} · ${identidad}`).rejects.toMatchObject({ data: { codigo: "NO_AUTORIZADO" } });
      }
    }
  }
  expect(await t.query(api.publico.instalacion, {})).toEqual({ modo: "live" });
  expect(await t.query(api.publico.cobro, { publicId })).toBeNull();
});
