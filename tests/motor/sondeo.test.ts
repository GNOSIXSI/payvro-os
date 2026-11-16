import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { insertarIntentoLive, insertarNegocioLive, nuevoLiveHarness, respuestaJson, transaccionWire, BANK_ID, QR_ID, TX_ID } from "./live-support";

import cuentaFixture from "../pey/formas/transacciones-cuenta.json";

const ID_TX_2 = "01CCCCCCCCCCCCCCCCCCCCCCCC";

function setLiveEnvironment(): void {
  vi.stubEnv("PAYVRO_MODE", "live");
  vi.stubEnv("PAYVRO_OWNER_EMAILS", "owner@example.invalid");
  vi.stubEnv("PEY_API_KEY", "pey-test-key-sentinel");
  vi.stubEnv("PEY_BANK_ACCOUNT_ID", BANK_ID);
}

function fixtureFetch(handler: (url: URL) => Response) {
  const fetcher: typeof globalThis.fetch = async (input) => handler(new URL(String(input)));
  vi.stubGlobal("fetch", vi.fn(fetcher));
  return vi.mocked(globalThis.fetch);
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

describe("LIVE QR verification and heartbeat at the Convex caller boundary", () => {
  it("requires account-list membership from a later page before releasing", async () => {
    const t = nuevoLiveHarness();
    const negocioId = await insertarNegocioLive(t);
    const { intentoId, cobroId } = await insertarIntentoLive(t, negocioId);
    const tx = transaccionWire(TX_ID);
    const fetcher = fixtureFetch((url) => {
      if (url.pathname === `/transaction/codi/qr/${QR_ID}`) {
        return respuestaJson(200, { items: [{ id: TX_ID }], nextToken: null });
      }
      if (url.pathname === `/transaction/${TX_ID}`) return respuestaJson(200, tx);
      if (url.pathname === `/transaction/bank-account/${BANK_ID}`) {
        if (url.searchParams.get("nextToken") === "account-page-2") {
          return respuestaJson(200, { items: [tx], nextToken: null });
        }
        return respuestaJson(200, { items: [], nextToken: "account-page-2" });
      }
      throw new Error("unexpected fake pey request");
    });

    await expect(t.action(internal.motor.verificar.verificarIntento, { intentoId, origen: "sondeo" }))
      .resolves.toEqual({ ok: true, resultado: "coincide" });
    const result = await t.run(async (ctx) => ({ cobro: await ctx.db.get(cobroId), pagos: await ctx.db.query("pagos").collect() }));
    expect(result.cobro?.estado).toBe("liberado");
    expect(result.pagos).toHaveLength(1);
    expect(fetcher.mock.calls.some(([input]) => new URL(String(input)).searchParams.get("nextToken") === "account-page-2")).toBe(true);
  });

  it("holds paid QR evidence for review when the configured-account list proves no membership", async () => {
    const t = nuevoLiveHarness();
    const negocioId = await insertarNegocioLive(t);
    const { intentoId, cobroId } = await insertarIntentoLive(t, negocioId);
    const tx = transaccionWire(TX_ID);
    fixtureFetch((url) => {
      if (url.pathname === `/transaction/codi/qr/${QR_ID}`) return respuestaJson(200, { items: [{ id: TX_ID }], nextToken: null });
      if (url.pathname === `/transaction/${TX_ID}`) return respuestaJson(200, tx);
      if (url.pathname === `/transaction/bank-account/${BANK_ID}`) return respuestaJson(200, { items: [], nextToken: null });
      throw new Error("unexpected fake pey request");
    });

    await expect(t.action(internal.motor.verificar.verificarIntento, { intentoId, origen: "sondeo" }))
      .resolves.toEqual({ ok: true, resultado: "destino_distinto" });
    const result = await t.run(async (ctx) => ({ cobro: await ctx.db.get(cobroId), pagos: await ctx.db.query("pagos").collect() }));
    expect(result.cobro).toMatchObject({ estado: "en_revision", motivoRevision: "destino_distinto" });
    expect(result.pagos).toHaveLength(1);
    expect(result.cobro?.estado).not.toBe("liberado");
  });

  it.each([
    { caso: "unrelated dropped row", items: cuentaFixture.items, resultado: "destino_distinto", ok: true },
    { caso: "relevant dropped row", items: [{ id: TX_ID, payableType: "UNRECOGNIZED" }], resultado: "diferida", ok: false },
    { caso: "unreadable dropped id", items: [{ payableType: "UNRECOGNIZED" }], resultado: "diferida", ok: false },
    { caso: "matching row and unrelated noise", items: [...cuentaFixture.items, transaccionWire(TX_ID)], resultado: "coincide", ok: true },
    { caso: "different amount", items: [transaccionWire(TX_ID, { amount: 150, amountBreakdown: { base: 150, tip: 0, fee: 0 } })], resultado: "monto_distinto", ok: true },
    { caso: "different datePaid only", items: [transaccionWire(TX_ID, { datePaid: 1794657601 })], resultado: "diferida", ok: false },
  ])("classifies account evidence: $caso", async ({ items, resultado, ok }) => {
    const t = nuevoLiveHarness();
    const negocioId = await insertarNegocioLive(t);
    const { intentoId, cobroId } = await insertarIntentoLive(t, negocioId);
    const fetcher = fixtureFetch((url) => {
      if (url.pathname === `/transaction/codi/qr/${QR_ID}`) return respuestaJson(200, { items: [{ id: TX_ID }], nextToken: null });
      if (url.pathname === `/transaction/${TX_ID}`) return respuestaJson(200, transaccionWire(TX_ID));
      if (url.pathname === `/transaction/bank-account/${BANK_ID}`) return respuestaJson(200, { items, nextToken: null });
      throw new Error("unexpected fake pey request");
    });
    await expect(t.action(internal.motor.verificar.verificarIntento, { intentoId, origen: "sondeo" }))
      .resolves.toEqual({ ok, resultado });
    const result = await t.run(async (ctx) => ({
      cobro: await ctx.db.get(cobroId), pagos: await ctx.db.query("pagos").collect(),
      bitacora: await ctx.db.query("bitacora").collect(),
    }));
    expect(fetcher.mock.calls.map(([input]) => new URL(String(input)).pathname)).toEqual([
      `/transaction/codi/qr/${QR_ID}`, `/transaction/${TX_ID}`, `/transaction/bank-account/${BANK_ID}`,
    ]);
    expect(result.pagos).toHaveLength(ok ? 1 : 0);
    if (resultado === "coincide") {
      expect(result.cobro?.estado).toBe("liberado");
      expect(result.bitacora.filter((row) => row.tipo === "cobro.liberado")).toHaveLength(1);
      await expect(t.action(internal.motor.verificar.verificarIntento, { intentoId, origen: "sondeo" }))
        .resolves.toEqual({ ok: true, resultado: "repetido" });
    } else {
      expect(result.cobro?.liberadoEn).toBeUndefined();
      expect(result.cobro?.estado).toBe(ok ? "en_revision" : "esperando_pago");
      expect(result.cobro?.motivoRevision).toBe(ok ? resultado : undefined);
      if (ok) expect(result.pagos[0].resultado).toBe(resultado);
    }
  });

  it("defers a paid detail while the account list still shows that id as pending, then releases once", async () => {
    const t = nuevoLiveHarness();
    const negocioId = await insertarNegocioLive(t);
    const { intentoId, cobroId, cobroPublicId } = await insertarIntentoLive(t, negocioId);
    let listadoPagado = false;
    fixtureFetch((url) => {
      if (url.pathname === `/transaction/codi/qr/${QR_ID}`) {
        return respuestaJson(200, { items: [{ id: TX_ID }], nextToken: null });
      }
      if (url.pathname === `/transaction/${TX_ID}`) return respuestaJson(200, transaccionWire(TX_ID));
      if (url.pathname === `/transaction/bank-account/${BANK_ID}`) {
        const fila = transaccionWire(TX_ID, listadoPagado ? {} : { status: "PENDING", datePaid: undefined });
        return respuestaJson(200, { items: [fila], nextToken: null });
      }
      throw new Error("unexpected fake pey request");
    });

    await expect(t.action(internal.motor.verificar.verificarIntento, { intentoId, origen: "sondeo" }))
      .resolves.toEqual({ ok: false, resultado: "diferida" });
    const diferido = await t.run(async (ctx) => ({
      cobro: await ctx.db.get(cobroId),
      intento: await ctx.db.get(intentoId),
      pagos: await ctx.db.query("pagos").collect(),
    }));
    expect(diferido.cobro?.estado).toBe("esperando_pago");
    expect(diferido.pagos).toHaveLength(0);
    expect(diferido.intento?.barridoActivo).toBe(true);
    await expect(t.mutation(api.publico.vigilar, { publicId: cobroPublicId })).resolves.toEqual({ ok: true });
    const sondeo = await t.run((ctx) => ctx.db.get(intentoId));
    expect(sondeo?.sondeoActivo).toBe(true);

    listadoPagado = true;
    await expect(t.action(internal.motor.verificar.verificarIntento, { intentoId, origen: "sondeo" }))
      .resolves.toEqual({ ok: true, resultado: "coincide" });
    const liberado = await t.run(async (ctx) => ({
      cobro: await ctx.db.get(cobroId),
      pagos: await ctx.db.query("pagos").collect(),
    }));
    expect(liberado.cobro?.estado).toBe("liberado");
    expect(liberado.pagos).toHaveLength(1);

    await expect(t.action(internal.motor.verificar.verificarIntento, { intentoId, origen: "sondeo" }))
      .resolves.toEqual({ ok: true, resultado: "repetido" });
    const otraVez = await t.run(async (ctx) => ctx.db.query("pagos").collect());
    expect(otraVez).toHaveLength(1);
  });

  it("defers when the account list drops its only row as an unrecognized payable", async () => {
    const t = nuevoLiveHarness();
    const negocioId = await insertarNegocioLive(t);
    const { intentoId, cobroId } = await insertarIntentoLive(t, negocioId);
    fixtureFetch((url) => {
      if (url.pathname === `/transaction/codi/qr/${QR_ID}`) return respuestaJson(200, { items: [{ id: TX_ID }], nextToken: null });
      if (url.pathname === `/transaction/${TX_ID}`) return respuestaJson(200, transaccionWire(TX_ID));
      if (url.pathname === `/transaction/bank-account/${BANK_ID}`) {
        return respuestaJson(200, {
          items: [{ id: TX_ID, status: "PAID", payableType: "UNRECOGNIZED", payableId: TX_ID }],
          nextToken: null,
        });
      }
      throw new Error("unexpected fake pey request");
    });

    await expect(t.action(internal.motor.verificar.verificarIntento, { intentoId, origen: "sondeo" }))
      .resolves.toEqual({ ok: false, resultado: "diferida" });
    const result = await t.run(async (ctx) => ({
      cobro: await ctx.db.get(cobroId),
      intento: await ctx.db.get(intentoId),
      pagos: await ctx.db.query("pagos").collect(),
    }));
    expect(result.cobro?.estado).toBe("esperando_pago");
    expect(result.cobro?.motivoRevision).toBeUndefined();
    expect(result.pagos).toHaveLength(0);
    expect(result.intento?.barridoActivo).toBe(true);
  });

  it("defers without releasing when the configured-account listing exceeds its page bound", async () => {
    const t = nuevoLiveHarness();
    const negocioId = await insertarNegocioLive(t);
    const { intentoId, cobroId } = await insertarIntentoLive(t, negocioId);
    const tx = transaccionWire(TX_ID);
    fixtureFetch((url) => {
      if (url.pathname === `/transaction/codi/qr/${QR_ID}`) return respuestaJson(200, { items: [{ id: TX_ID }], nextToken: null });
      if (url.pathname === `/transaction/${TX_ID}`) return respuestaJson(200, tx);
      if (url.pathname === `/transaction/bank-account/${BANK_ID}`) {
        const page = Number(url.searchParams.get("nextToken") ?? "0");
        return respuestaJson(200, { items: [], nextToken: String(page + 1) });
      }
      throw new Error("unexpected fake pey request");
    });

    await expect(t.action(internal.motor.verificar.verificarIntento, { intentoId, origen: "sondeo" }))
      .resolves.toEqual({ ok: false, resultado: "evidencia_incompleta" });
    const result = await t.run(async (ctx) => ({ cobro: await ctx.db.get(cobroId), pagos: await ctx.db.query("pagos").collect() }));
    expect(result.cobro?.estado).toBe("esperando_pago");
    expect(result.pagos).toHaveLength(0);
  });

  it("collects all bounded QR pages so a later second payment cannot be ignored", async () => {
    const t = nuevoLiveHarness();
    const negocioId = await insertarNegocioLive(t);
    const { intentoId, cobroId } = await insertarIntentoLive(t, negocioId);
    const first = transaccionWire(TX_ID);
    const second = transaccionWire(ID_TX_2);
    fixtureFetch((url) => {
      if (url.pathname === `/transaction/codi/qr/${QR_ID}`) {
        if (url.searchParams.get("nextToken") === "qr-page-2") return respuestaJson(200, { items: [{ id: ID_TX_2 }], nextToken: null });
        return respuestaJson(200, { items: [{ id: TX_ID }], nextToken: "qr-page-2" });
      }
      if (url.pathname === `/transaction/${TX_ID}`) return respuestaJson(200, first);
      if (url.pathname === `/transaction/${ID_TX_2}`) return respuestaJson(200, second);
      if (url.pathname === `/transaction/bank-account/${BANK_ID}`) return respuestaJson(200, { items: [first, second], nextToken: null });
      throw new Error("unexpected fake pey request");
    });

    await expect(t.action(internal.motor.verificar.verificarIntento, { intentoId, origen: "barrido" }))
      .resolves.toEqual({ ok: true, resultado: "duplicado" });
    const result = await t.run(async (ctx) => ({ cobro: await ctx.db.get(cobroId), pagos: await ctx.db.query("pagos").collect() }));
    expect(result.cobro).toMatchObject({ estado: "en_revision", motivoRevision: "duplicado" });
    expect(result.pagos).toHaveLength(2);
  });

  it("drains one heartbeat chain until the deadline and does not fork on repeated calls", async () => {
    const t = nuevoLiveHarness();
    const negocioId = await insertarNegocioLive(t);
    const { intentoId, cobroPublicId } = await insertarIntentoLive(t, negocioId);
    const fetcher = fixtureFetch((url) => {
      if (url.pathname === `/transaction/codi/qr/${QR_ID}`) return respuestaJson(200, { items: [], nextToken: null });
      throw new Error("unexpected fake pey request");
    });
    await t.mutation(api.publico.vigilar, { publicId: cobroPublicId });
    await t.mutation(api.publico.vigilar, { publicId: cobroPublicId });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const intento = await t.run((ctx) => ctx.db.get(intentoId));
    expect(intento?.sondeoActivo).toBe(false);
    expect(intento?.sondeos).toBeGreaterThan(1);
    expect(fetcher).toHaveBeenCalledTimes(intento?.sondeos ?? 0);
    expect(fetcher.mock.calls.length).toBeLessThanOrEqual(20);
  });

  it("backs off on a GET 429 from two to four seconds", async () => {
    const t = nuevoLiveHarness();
    const negocioId = await insertarNegocioLive(t);
    const { intentoId, cobroPublicId } = await insertarIntentoLive(t, negocioId);
    const fetcher = fixtureFetch((url) => {
      if (url.pathname === `/transaction/codi/qr/${QR_ID}`) {
        return respuestaJson(429, { error: { type: "RATE_LIMIT", message: "slow down" } });
      }
      throw new Error("unexpected fake pey request");
    });
    await t.mutation(api.publico.vigilar, { publicId: cobroPublicId });
    let intento = await t.run((ctx) => ctx.db.get(intentoId));
    await t.action(internal.motor.verificar.tickSondeo, { intentoId, leaseId: intento!.sondeoLeaseId! });
    intento = await t.run((ctx) => ctx.db.get(intentoId));
    expect(intento?.sondeoBackoffMs).toBe(2_000);
    expect(fetcher).toHaveBeenCalledTimes(1);

    await t.action(internal.motor.verificar.tickSondeo, { intentoId, leaseId: intento!.sondeoLeaseId! });
    intento = await t.run((ctx) => ctx.db.get(intentoId));
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(intento?.sondeoBackoffMs).toBe(4_000);
  });

  it("does not restart a chain after the fifteen-minute lifetime cap", async () => {
    const t = nuevoLiveHarness();
    const negocioId = await insertarNegocioLive(t);
    const { intentoId, cobroPublicId } = await insertarIntentoLive(t, negocioId);
    const inicioOriginal = Date.now() - 15 * 60 * 1000;
    await t.run(async (ctx) => ctx.db.patch(intentoId, {
      sondeoInicioEn: inicioOriginal,
      sondeoActivo: false,
    }));
    await expect(t.mutation(api.publico.vigilar, { publicId: cobroPublicId })).resolves.toEqual({ ok: true });
    const intento = await t.run((ctx) => ctx.db.get(intentoId));
    expect(intento?.sondeoActivo).toBe(false);
    expect(intento?.sondeoInicioEn).toBe(inicioOriginal);
  });

  it("two heartbeats retain one lease and a crashed lease can be reclaimed", async () => {
    const t = nuevoLiveHarness();
    const negocioId = await insertarNegocioLive(t);
    const { intentoId, cobroPublicId } = await insertarIntentoLive(t, negocioId);
    const heartbeat = t.mutation(api.publico.vigilar, { publicId: cobroPublicId });
    await expect(heartbeat).resolves.toEqual({ ok: true });
    const first = await t.run((ctx) => ctx.db.get(intentoId));
    await expect(t.mutation(api.publico.vigilar, { publicId: cobroPublicId })).resolves.toEqual({ ok: true });
    const second = await t.run((ctx) => ctx.db.get(intentoId));
    expect(second?.sondeoLeaseId).toBe(first?.sondeoLeaseId);
    expect(second?.sondeoInicioEn).toBe(first?.sondeoInicioEn);

    await t.run(async (ctx) => {
      await ctx.db.patch(intentoId, { sondeoLeaseHasta: Date.now() - 1 });
    });
    await expect(t.mutation(api.publico.vigilar, { publicId: cobroPublicId })).resolves.toEqual({ ok: true });
    const reclaimed = await t.run((ctx) => ctx.db.get(intentoId));
    expect(reclaimed?.sondeoLeaseId).not.toBe(first?.sondeoLeaseId);
    expect(reclaimed?.sondeoInicioEn).toBe(first?.sondeoInicioEn);
  });
});
