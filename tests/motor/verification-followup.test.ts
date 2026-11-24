import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { insertarIntentoLive, insertarNegocioLive, nuevoLiveHarness, respuestaJson, transaccionWire, BANK_ID, QR_ID, TX_ID } from "./live-support";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-14T12:00:00Z"));
  vi.stubEnv("PAYVRO_MODE", "live");
  vi.stubEnv("PAYVRO_OWNER_EMAILS", "owner@example.invalid");
  vi.stubEnv("PEY_API_KEY", "synthetic-test-key");
  vi.stubEnv("PEY_BANK_ACCOUNT_ID", BANK_ID);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });

async function escenario() {
  const t = nuevoLiveHarness();
  const negocioId = await insertarNegocioLive(t);
  const ids = await insertarIntentoLive(t, negocioId);
  let account: unknown[] = [{ id: TX_ID, payableType: "UNRECOGNIZED" }];
  let paid = true;
  vi.stubGlobal("fetch", vi.fn(async (input: unknown) => {
    const url = new URL(String(input));
    if (url.pathname === `/transaction/codi/qr/${QR_ID}`) return respuestaJson(200, { items: paid ? [{ id: TX_ID }] : [], nextToken: null });
    if (url.pathname === `/transaction/${TX_ID}`) return respuestaJson(200, transaccionWire(TX_ID));
    if (url.pathname === `/transaction/bank-account/${BANK_ID}`) return respuestaJson(200, { items: account, nextToken: null });
    throw new Error("Unexpected synthetic request");
  }));
  const poll = (observacionId?: string) => t.action(internal.motor.verificar.verificarIntento, { intentoId: ids.intentoId, origen: "sondeo", ...(observacionId ? { observacionId } : {}) });
  const detail = () => t.withIdentity({ email: "owner@example.invalid", emailVerified: true }).query(api.cobros.obtener, { publicId: ids.cobroPublicId });
  const log = () => t.run((ctx) => ctx.db.query("bitacora").withIndex("by_cobro_seq", (q) => q.eq("cobroId", ids.cobroId)).collect());
  return { t, negocioId, ...ids, poll, detail, log, setAccount: (rows: unknown[]) => { account = rows; }, setPaid: (value: boolean) => { paid = value; } };
}

it("escalates at three distinct unreadable checks, not two, and alerts only once at four", async () => {
  const s = await escenario();
  for (let n = 1; n <= 4; n++) {
    await s.poll();
    expect((await s.detail())?.estado).toBe(n < 3 ? "esperando_pago" : "en_revision");
    expect((await s.log()).filter((row) => row.tipo === "cobro.en_revision")).toHaveLength(n < 3 ? 0 : 1);
  }
  expect(await s.t.run((ctx) => ctx.db.query("pagos").collect())).toEqual([]);
  expect((await s.t.run((ctx) => ctx.db.get(s.negocioId)))?.enRevisionCount).toBe(1);
  const page = await s.t.withIdentity({ email: "owner@example.invalid", emailVerified: true }).query(api.panel.bitacora, {
    cobroPublicId: s.cobroPublicId, paginationOpts: { cursor: null, numItems: 30 },
  });
  expect(page.page.filter((row) => row.tipo === "cobro.en_revision")).toMatchObject([
    { estadoDespues: "en_revision", detalle: { motivo: "evidencia_ilegible" } },
  ]);
});

it("resets a legacy missing streak on definitive no-payment evidence, then starts anew", async () => {
  const s = await escenario();
  await s.poll(); await s.poll();
  s.setPaid(false); await s.poll(); s.setPaid(true);
  await s.poll(); await s.poll();
  expect((await s.detail())?.estado).toBe("esperando_pago");
  await s.poll();
  expect((await s.detail())?.estado).toBe("en_revision");
});

it.each(["before", "during", "after"])("expiry %s escalation never leaves unresolved evidence ordinarily expired", async (timing) => {
  const s = await escenario();
  if (timing !== "before") await s.poll();
  if (timing === "after") { await s.poll(); await s.poll(); }
  await s.t.run((ctx) => ctx.db.patch(s.cobroId, { expiraEn: Date.now() - 1 }));
  await s.t.mutation(internal.motor.cobros.expirarVencidos, {});
  expect((await s.detail())?.estado).toBe(timing === "before" ? "expirado" : "en_revision");
  await s.poll();
  expect((await s.detail())?.estado).toBe("en_revision");
  await s.poll(); await s.poll();
  await s.t.mutation(internal.motor.cobros.expirarVencidos, {});
  expect((await s.detail())?.estado).toBe("en_revision");
  expect((await s.log()).filter((row) => row.tipo === "cobro.en_revision")).toHaveLength(1);
  expect((await s.detail())?.pago).toBeNull();
});

it("still expires ordinary unpaid charges and never regresses a released charge", async () => {
  const s = await escenario();
  s.setPaid(false); await s.poll();
  await s.t.run((ctx) => ctx.db.patch(s.cobroId, { expiraEn: Date.now() - 1 }));
  await s.t.mutation(internal.motor.cobros.expirarVencidos, {});
  expect((await s.detail())?.estado).toBe("expirado");
  const other = await escenario();
  other.setAccount([transaccionWire(TX_ID)]); await other.poll();
  other.setAccount([{ id: TX_ID, payableType: "UNRECOGNIZED" }]);
  await other.poll(); await other.poll(); await other.poll();
  await other.t.run((ctx) => ctx.db.patch(other.cobroId, { expiraEn: Date.now() - 1 }));
  await other.t.mutation(internal.motor.cobros.expirarVencidos, {});
  expect((await other.detail())?.estado).toBe("liberado");
  expect((await other.log()).filter((row) => row.tipo === "cobro.liberado")).toHaveLength(1);
});

it.each(["valid", "negocio", "cobro", "modo"])("owner detail validates linked pago: %s", async (variant) => {
  const s = await escenario();
  s.setAccount([transaccionWire(TX_ID)]); await s.poll();
  const pagoId = (await s.t.run((ctx) => ctx.db.get(s.cobroId)))!.pagoId!;
  if (variant === "negocio") {
    const foreign = await insertarNegocioLive(s.t);
    await s.t.run(async (ctx) => { await ctx.db.patch(foreign, { modo: "demo" }); await ctx.db.patch(pagoId, { negocioId: foreign }); });
  }
  if (variant === "cobro") {
    const foreign = await insertarIntentoLive(s.t, s.negocioId);
    await s.t.run((ctx) => ctx.db.patch(pagoId, { cobroId: foreign.cobroId }));
  }
  if (variant === "modo") await s.t.run((ctx) => ctx.db.patch(pagoId, { modo: "demo" }));
  const result = await s.detail();
  if (variant === "valid") expect(result?.pago).toMatchObject({ resultado: "coincide", baseCentavos: 1 });
  else expect(result?.pago).toBeNull();
});

it("deduplicates old observation deliveries even after another check and a readable reset", async () => {
  const s = await escenario();
  await Promise.all([s.poll("check-1"), s.poll("check-1")]);
  await s.poll("check-2"); await s.poll("check-1");
  expect((await s.detail())?.estado).toBe("esperando_pago");
  s.setPaid(false); await s.poll("reset"); s.setPaid(true);
  await s.poll("check-1"); await s.poll("check-2");
  await s.poll("check-3"); await s.poll("check-4");
  expect((await s.detail())?.estado).toBe("esperando_pago");
  await s.poll("check-5"); await s.poll("check-5");
  expect((await s.detail())?.estado).toBe("en_revision");
  expect((await s.log()).filter((row) => row.tipo === "cobro.en_revision")).toHaveLength(1);
});

it("does not count unrelated unreadable rows or treat them as unresolved at expiry", async () => {
  const s = await escenario();
  s.setAccount([{ id: "01CCCCCCCCCCCCCCCCCCCCCCCC", payableType: "UNRECOGNIZED" }, transaccionWire(TX_ID)]);
  await s.poll(); await s.poll(); await s.poll(); await s.poll();
  expect((await s.detail())?.estado).toBe("liberado");
  expect((await s.log()).filter((row) => row.tipo === "cobro.en_revision")).toHaveLength(0);
});

it.each(["same QR", "other attempt"].flatMap((path) =>
  [false, true].map((review) => ({ path, review })),
))("reports a second payment consistently via $path / review=$review", async ({ path, review }) => {
  const s = await escenario();
  s.setAccount([transaccionWire(TX_ID, review ? { amount: 0.02, amountBreakdown: { base: 0.02, tip: 0, fee: 0 } } : {})]); await s.poll();
  const original = await s.detail();
  const originalIntento = (await s.t.run((ctx) => ctx.db.get(s.intentoId)))!;
  let intentoId = s.intentoId;
  const payableId = path === "same QR" ? QR_ID : "OTHER-QR-EXAMPLE";
  if (path === "other attempt") {
    intentoId = await s.t.run((ctx) => {
      const { _id, _creationTime, ...fields } = originalIntento;
      void _id; void _creationTime;
      return ctx.db.insert("intentos", { ...fields, publicId: "int_other_example", estado: "descartado", peyPayableId: payableId, claveIdempotencia: "other-example-key" });
    });
  }
  const tx = {
    transactionId: "second-example", status: "PAID" as const, amount: 0.01,
    amountBreakdown: { base: 0.01, tip: 0, fee: 0 }, currency: "MXN", paymentMethod: "CODI" as const,
    payableType: "API_CODI_QR" as const, payableId,
    dateCreated: "2026-11-14T12:00:00Z", datePaid: "2026-11-14T12:00:01Z", metadata: {},
  };
  const firstTx = { ...tx, transactionId: TX_ID, payableId: QR_ID };
  const args = { intentoId, origen: "barrido" as const, evidencia: { transacciones: path === "same QR" ? [firstTx, tx] : [tx], destinoConfirmado: true } };
  await expect(s.t.mutation(internal.motor.verificar.aplicarEvidencia, args)).resolves.toEqual({ ok: true, resultado: "duplicado" });
  await expect(s.t.mutation(internal.motor.verificar.aplicarEvidencia, args)).resolves.toEqual({ ok: true, resultado: "repetido" });
  expect(await s.detail()).toMatchObject({ estado: review ? "en_revision" : "liberado", alerta: "pago_duplicado", pago: original!.pago });
  const log = await s.log();
  expect(log.filter((row) => row.tipo === "pago.duplicado")).toMatchObject([{ detalle: { motivo: "duplicado" } }]);
  expect(log.filter((row) => row.tipo === "cobro.liberado")).toHaveLength(review ? 0 : 1);
  expect(log.filter((row) => row.tipo === "cobro.en_revision")).toHaveLength(review ? 1 : 0);
});

it("a readable different attempt cannot erase unresolved evidence before expiry", async () => {
  const s = await escenario();
  await s.poll();
  const otherId = await s.t.run(async (ctx) => {
    const { _id, _creationTime, ...fields } = (await ctx.db.get(s.intentoId))!;
    void _id; void _creationTime;
    return ctx.db.insert("intentos", {
      ...fields, publicId: "int_other_readable", estado: "descartado", claveIdempotencia: "other-readable-example",
      evidenciaPendiente: undefined, ilegiblesConsecutivos: undefined,
    });
  });
  s.setPaid(false);
  await s.t.action(internal.motor.verificar.verificarIntento, { intentoId: otherId, origen: "barrido" });
  await s.t.run((ctx) => ctx.db.patch(s.cobroId, { expiraEn: Date.now() - 1 }));
  await s.t.mutation(internal.motor.cobros.expirarVencidos, {});
  expect((await s.detail())?.estado).toBe("en_revision");
});

it("keeps verified-but-not-yet-released charges terminal under unreadable checks and expiry", async () => {
  const s = await escenario();
  s.setAccount([transaccionWire(TX_ID)]); await s.poll();
  await s.t.run((ctx) => ctx.db.patch(s.cobroId, { estado: "pagado_verificado", liberadoEn: undefined, expiraEn: Date.now() - 1 }));
  s.setAccount([{ id: TX_ID, payableType: "UNRECOGNIZED" }]);
  await s.poll(); await s.poll(); await s.poll();
  await s.t.mutation(internal.motor.cobros.expirarVencidos, {});
  expect((await s.detail())?.estado).toBe("pagado_verificado");
  expect((await s.log()).filter((row) => row.tipo === "cobro.en_revision")).toHaveLength(0);
});
