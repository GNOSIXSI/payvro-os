import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { internal } from "../../convex/_generated/api";
import { insertarIntentoLive, insertarNegocioLive, nuevoLiveHarness, respuestaJson, BANK_ID, QR_ID, TX_ID } from "./live-support";

function setLiveEnvironment(): void {
  vi.stubEnv("PAYVRO_MODE", "live");
  vi.stubEnv("PEY_API_KEY", "pey-test-key-sentinel");
  vi.stubEnv("PEY_BANK_ACCOUNT_ID", BANK_ID);
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

describe("bounded LIVE per-attempt recovery", () => {
  it("recovers a known paid attempt without any heartbeat", async () => {
    const t = nuevoLiveHarness();
    const negocioId = await insertarNegocioLive(t);
    const { intentoId, cobroId } = await insertarIntentoLive(t, negocioId, { ageMs: 60_000 });
    const tx = {
      id: "01AAAAAAAAAAAAAAAAAAAAAAAA",
      status: "PAID",
      amount: 0.01,
      amountBreakdown: { base: 0.01, tip: 0, fee: 0 },
      currency: "MXN",
      paymentMethod: "CODI",
      payableType: "API_CODI_QR",
      payableId: QR_ID,
      dateCreated: 1_704_067_200,
      datePaid: 1_704_067_260,
      metadata: { externalMetadata: { payvro_cobro: "cob_test", payvro_intento: "int_test", payvro_modo: "live" } },
    };
    const fetcher: typeof globalThis.fetch = async (input) => {
      const url = new URL(String(input));
      if (url.pathname === `/transaction/codi/qr/${QR_ID}`) return respuestaJson(200, { items: [{ id: tx.id }], nextToken: null });
      if (url.pathname === `/transaction/${tx.id}`) return respuestaJson(200, tx);
      if (url.pathname === `/transaction/bank-account/${BANK_ID}`) return respuestaJson(200, { items: [tx], nextToken: null });
      throw new Error("unexpected fake pey request");
    };
    vi.stubGlobal("fetch", vi.fn(fetcher));

    await expect(t.action(internal.motor.barrido.recuperar, {})).resolves.toEqual({ revisados: 1 });
    const result = await t.run(async (ctx) => ({ cobro: await ctx.db.get(cobroId), pagos: await ctx.db.query("pagos").collect() }));
    expect(result.cobro?.estado).toBe("liberado");
    expect(result.pagos).toHaveLength(1);
    const intento = await t.run((ctx) => ctx.db.get(intentoId));
    expect(intento?.sondeos).toBe(1);
  });

  it("holds a paid cancelled attempt for late-payment review", async () => {
    const t = nuevoLiveHarness();
    const negocioId = await insertarNegocioLive(t);
    const { cobroId } = await insertarIntentoLive(t, negocioId, { estado: "descartado", ageMs: 60_000 });
    const tx = {
      id: TX_ID,
      status: "PAID",
      amount: 0.01,
      amountBreakdown: { base: 0.01, tip: 0, fee: 0 },
      currency: "MXN",
      paymentMethod: "CODI",
      payableType: "API_CODI_QR",
      payableId: QR_ID,
      dateCreated: 1_704_067_200,
      datePaid: 1_704_067_260,
      metadata: { externalMetadata: { payvro_cobro: "cob_test", payvro_intento: "int_test", payvro_modo: "live" } },
    };
    const fetcher: typeof globalThis.fetch = async (input) => {
      const url = new URL(String(input));
      if (url.pathname === `/transaction/codi/qr/${QR_ID}`) return respuestaJson(200, { items: [{ id: TX_ID }], nextToken: null });
      if (url.pathname === `/transaction/${TX_ID}`) return respuestaJson(200, tx);
      if (url.pathname === `/transaction/bank-account/${BANK_ID}`) return respuestaJson(200, { items: [tx], nextToken: null });
      throw new Error("unexpected fake pey request");
    };
    vi.stubGlobal("fetch", vi.fn(fetcher));

    await expect(t.action(internal.motor.barrido.recuperar, {})).resolves.toEqual({ revisados: 1 });
    const result = await t.run(async (ctx) => ({ cobro: await ctx.db.get(cobroId), pagos: await ctx.db.query("pagos").collect() }));
    expect(result.cobro).toMatchObject({ estado: "en_revision", motivoRevision: "pago_tardio" });
    expect(result.pagos).toMatchObject([{ resultado: "pago_tardio" }]);
  });

  it("processes no more than twenty oldest eligible attempts and makes progress on the next run", async () => {
    const t = nuevoLiveHarness();
    const negocioId = await insertarNegocioLive(t);
    const attempts = await Promise.all(Array.from({ length: 21 }, (_, index) =>
      insertarIntentoLive(t, negocioId, { ageMs: 60_000 + index }),
    ));
    const fetcher: typeof globalThis.fetch = async (input) => {
      const url = new URL(String(input));
      if (url.pathname === `/transaction/codi/qr/${QR_ID}`) return respuestaJson(200, { items: [], nextToken: null });
      throw new Error("unexpected fake pey request");
    };
    vi.stubGlobal("fetch", vi.fn(fetcher));

    await expect(t.action(internal.motor.barrido.recuperar, {})).resolves.toEqual({ revisados: 20 });
    const firstCounts = await t.run(async (ctx) => Promise.all(attempts.map(async ({ intentoId }) => (await ctx.db.get(intentoId))?.sondeos ?? 0)));
    expect(firstCounts.filter((count) => count === 1)).toHaveLength(20);
    expect(firstCounts.filter((count) => count === 0)).toHaveLength(1);

    await expect(t.action(internal.motor.barrido.recuperar, {})).resolves.toEqual({ revisados: 1 });
    const finalCounts = await t.run(async (ctx) => Promise.all(attempts.map(async ({ intentoId }) => (await ctx.db.get(intentoId))?.sondeos ?? 0)));
    expect(finalCounts).toEqual(Array(21).fill(1));
  });

  it("does not invent a provider id for a discarded attempt without peyPayableId", async () => {
    const t = nuevoLiveHarness();
    const negocioId = await insertarNegocioLive(t);
    const { intentoId } = await insertarIntentoLive(t, negocioId, { estado: "descartado", ageMs: 60_000 });
    await t.run(async (ctx) => ctx.db.patch(intentoId, { peyPayableId: undefined }));
    const fetcher = vi.fn(async () => {
      throw new Error("no request may be made without a recorded pey id");
    });
    vi.stubGlobal("fetch", fetcher);

    await expect(t.action(internal.motor.barrido.recuperar, {})).resolves.toEqual({ revisados: 0 });
    expect(fetcher).not.toHaveBeenCalled();
    const intento = await t.run((ctx) => ctx.db.get(intentoId));
    expect(intento?.barridoActivo).toBe(false);
  });
});
