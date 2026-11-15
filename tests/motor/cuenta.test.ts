import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConvexError } from "convex/values";
import { api, internal } from "../../convex/_generated/api";
import { insertarNegocioLive, nuevoLiveHarness, respuestaJson, BANK_ID, QR_ID } from "./live-support";

function setLiveEnvironment(): void {
  vi.stubEnv("PAYVRO_MODE", "live");
  vi.stubEnv("PAYVRO_OWNER_EMAILS", "owner@example.invalid");
  vi.stubEnv("PEY_API_KEY", "pey-test-key-sentinel");
  vi.stubEnv("PEY_BANK_ACCOUNT_ID", BANK_ID);
}

function codigo(error: unknown): string | undefined {
  return error instanceof ConvexError && typeof error.data === "object" && error.data !== null && "codigo" in error.data
    ? String(error.data.codigo)
    : undefined;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-14T12:00:00.000Z"));
  setLiveEnvironment();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("LIVE account readiness", () => {
  it("preflights the configured account and persists only the safe status and check time", async () => {
    const t = nuevoLiveHarness();
    const negocioId = await insertarNegocioLive(t);
    const fetcher: typeof globalThis.fetch = async (input) => {
      expect(String(input)).toBe(`https://api.pey.mx/bank-account/${BANK_ID}`);
      return respuestaJson(200, {
        id: BANK_ID,
        codiStatus: "ACTIVE",
        clabe: "000000000000000000",
        name: "Dulces Ana — Ejemplo",
      });
    };
    vi.stubGlobal("fetch", vi.fn(fetcher));

    await expect(t.action(internal.motor.cuenta.comprobarCuenta, {})).resolves.toEqual({ ok: true, estado: "ACTIVE" });
    const negocio = await t.run((ctx) => ctx.db.get(negocioId));
    expect(negocio).toMatchObject({ estadoCuentaPey: "ACTIVE", cuentaRevisadaEn: Date.now() });
    expect(negocio).not.toHaveProperty("clabe");
    expect(negocio).not.toHaveProperty("bankAccountId");
    expect(JSON.stringify(negocio)).not.toMatch(/holder|PEY_API_KEY/i);
  });

  it("records missing credentials as a safe non-ready status without a network call", async () => {
    vi.stubEnv("PEY_API_KEY", "");
    const t = nuevoLiveHarness();
    const negocioId = await insertarNegocioLive(t);
    const fetcher = vi.fn(async () => { throw new Error("missing config must block before fetch"); });
    vi.stubGlobal("fetch", fetcher);

    await expect(t.action(internal.motor.cuenta.comprobarCuenta, {})).resolves.toEqual({ ok: false, estado: "CONFIGURACION_AUSENTE" });
    expect(fetcher).not.toHaveBeenCalled();
    const negocio = await t.run((ctx) => ctx.db.get(negocioId));
    expect(negocio).toMatchObject({ estadoCuentaPey: "CONFIGURACION_AUSENTE", cuentaRevisadaEn: Date.now() });
    expect(negocio).not.toHaveProperty("apiKey");
    expect(negocio).not.toHaveProperty("bankAccountId");
  });

  it("refuses missing configuration before reserving a cobro or intento", async () => {
    vi.stubEnv("PEY_API_KEY", "");
    const t = nuevoLiveHarness();
    await insertarNegocioLive(t);
    const autorizado = t.withIdentity({ email: "owner@example.invalid", emailVerified: true });
    const error = await autorizado.mutation(api.cobros.crear, {
      claveIdempotencia: "live-missing-config-0001",
      concepto: "Pedido de ejemplo",
      montoCentavos: 1,
    }).then(() => null, (failure: unknown) => failure);
    expect(codigo(error)).toBe("CUENTA_NO_ACTIVA");
    const state = await t.run(async (ctx) => ({ cobros: await ctx.db.query("cobros").collect(), intentos: await ctx.db.query("intentos").collect() }));
    expect(state.cobros).toHaveLength(0);
    expect(state.intentos).toHaveLength(0);
  });

  it("treats a dispatched POST 500 as uncertain and rejects duplicate action delivery", async () => {
    const t = nuevoLiveHarness();
    await insertarNegocioLive(t);
    const autorizado = t.withIdentity({ email: "owner@example.invalid", emailVerified: true });
    const fetcher: typeof globalThis.fetch = vi.fn(async () => respuestaJson(500, { error: { message: "provider failure" } }));
    vi.stubGlobal("fetch", fetcher);
    await autorizado.mutation(api.cobros.crear, {
      claveIdempotencia: "live-unknown-post-000001",
      concepto: "Pedido de ejemplo",
      montoCentavos: 1,
    });
    const intento = await t.run((ctx) => ctx.db.query("intentos").first());
    expect(intento).toBeTruthy();
    const resultados = await Promise.all([
      t.action(internal.motor.intentos.crearEnPey, { intentoId: intento!._id }),
      t.action(internal.motor.intentos.crearEnPey, { intentoId: intento!._id }),
    ]);
    expect(resultados.filter((resultado) => resultado.ok)).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const persisted = await t.run((ctx) => ctx.db.get(intento!._id));
    expect(persisted?.estado).toBe("incierto");
  });

  it("requires fresh ACTIVE readiness, blocks LIVE links before reservation, and allows one QR dispatch", async () => {
    const t = nuevoLiveHarness();
    const negocioId = await insertarNegocioLive(t);
    await t.run(async (ctx) => ctx.db.patch(negocioId, { estadoCuentaPey: "PENDING" }));
    const autorizado = t.withIdentity({ email: "owner@example.invalid", emailVerified: true });
    const inactiveError = await autorizado.mutation(api.cobros.crear, {
      claveIdempotencia: "live-inactive-account-0001",
      concepto: "Pedido de ejemplo",
      montoCentavos: 1,
    }).then(() => null, (failure: unknown) => failure);
    expect(codigo(inactiveError)).toBe("CUENTA_NO_ACTIVA");

    await t.run(async (ctx) => ctx.db.patch(negocioId, {
      estadoCuentaPey: "ACTIVE",
      cuentaRevisadaEn: Date.now() - 24 * 60 * 60 * 1000 - 1,
    }));
    const staleError = await autorizado.mutation(api.cobros.crear, {
      claveIdempotencia: "live-stale-account-00001",
      concepto: "Pedido de ejemplo",
      montoCentavos: 1,
    }).then(() => null, (failure: unknown) => failure);
    expect(codigo(staleError)).toBe("CUENTA_NO_ACTIVA");

    await t.run(async (ctx) => ctx.db.patch(negocioId, { cuentaRevisadaEn: Date.now() }));
    const fetcher: typeof globalThis.fetch = vi.fn(async (input) => {
      const url = new URL(String(input));
      if (url.pathname === "/codi/qr") return respuestaJson(201, { id: QR_ID, qrString: "qr-payload-example" });
      throw new Error("unexpected fake pey request");
    });
    vi.stubGlobal("fetch", fetcher);
    const linkError = await autorizado.mutation(api.cobros.crear, {
      claveIdempotencia: "live-link-disabled-00001",
      concepto: "Pedido de ejemplo",
      montoCentavos: 1,
      tipo: "link",
    }).then(() => null, (failure: unknown) => failure);
    expect(codigo(linkError)).toBe("TRANSICION_INVALIDA");
    const beforeQr = await t.run(async (ctx) => ({ cobros: await ctx.db.query("cobros").collect(), intentos: await ctx.db.query("intentos").collect() }));
    expect(beforeQr.cobros).toHaveLength(0);
    expect(beforeQr.intentos).toHaveLength(0);
    expect(fetcher).not.toHaveBeenCalled();

    const created = await autorizado.mutation(api.cobros.crear, {
      claveIdempotencia: "live-qr-create-0000001",
      concepto: "Pedido de ejemplo",
      montoCentavos: 1,
    });
    const attemptsBeforeAction = await t.run((ctx) => ctx.db.query("intentos").collect());
    const intentoId = attemptsBeforeAction[0]._id;
    await expect(t.action(internal.motor.intentos.crearEnPey, { intentoId })).resolves.toEqual({ ok: true });
    await expect(t.action(internal.motor.intentos.crearEnPey, { intentoId })).resolves.toEqual({ ok: false });
    const detail = await autorizado.query(api.cobros.obtener, { publicId: created.publicId });
    expect(detail).toMatchObject({ estado: "esperando_pago", intentoActivo: { tipo: "qr", estado: "creado", qrString: "qr-payload-example" } });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
