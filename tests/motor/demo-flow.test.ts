import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConvexError } from "convex/values";
import { convexTest } from "convex-test";
import { api, internal } from "../../convex/_generated/api";
import schema from "../../convex/schema";

function nuevoHarness() {
  return convexTest(schema, import.meta.glob("../../convex/**/*.ts"));
}

async function terminarTrabajos(t: ReturnType<typeof nuevoHarness>): Promise<void> {
  await t.finishAllScheduledFunctions(vi.runAllTimers);
}

async function leerEstado(t: ReturnType<typeof nuevoHarness>) {
  return t.run(async (ctx) => ({
    negocios: await ctx.db.query("negocios").collect(),
    cobros: await ctx.db.query("cobros").collect(),
    intentos: await ctx.db.query("intentos").collect(),
    pagos: await ctx.db.query("pagos").collect(),
    transacciones: await ctx.db.query("simTransacciones").collect(),
    bitacora: await ctx.db.query("bitacora").collect(),
  }));
}

async function esperarCodigo(accion: Promise<unknown>, codigo: string): Promise<void> {
  const error = await accion.then(() => null, (fallo: unknown) => fallo);
  expect(error).toBeInstanceOf(ConvexError);
  expect((error as ConvexError<{ codigo: string }>).data.codigo).toBe(codigo);
}

async function crearCobro(t: ReturnType<typeof nuevoHarness>, clave: string, montoCentavos = 14900) {
  return t.mutation(api.cobros.crear, {
    claveIdempotencia: clave,
    concepto: "Pedido de ejemplo",
    montoCentavos,
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-14T12:00:00.000Z"));
  vi.stubEnv("PAYVRO_MODE", "demo");
  vi.stubEnv("PAYVRO_OWNER_EMAILS", "owner@example.invalid");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("persisted DEMO engine at the Convex caller boundary", () => {
  it("creates, simulates, verifies and releases once with ordered bitácora", async () => {
    const outbound = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("DEMO attempted network access"));
    const t = nuevoHarness();
    const cobro = await crearCobro(t, "demo-flow-exacto-000001");
    await terminarTrabajos(t);

    const antesDePago = await t.query(api.cobros.obtener, { publicId: cobro.publicId });
    expect(antesDePago).toMatchObject({
      estado: "esperando_pago",
      intentoActivo: { estado: "creado", tipo: "qr", qrString: expect.stringContaining("PAYVRO-DEMO:") },
    });

    await t.mutation(api.demo.simularPago, { publicId: cobro.publicId, variante: "exacto" });
    await terminarTrabajos(t);

    const despues = await t.query(api.cobros.obtener, { publicId: cobro.publicId });
    const estado = await leerEstado(t);
    const bitacora = estado.bitacora.sort((a, b) => a.seq - b.seq);
    const vistaBitacora = await t.query(api.panel.bitacora, {
      cobroPublicId: cobro.publicId,
      paginationOpts: { numItems: 50, cursor: null },
    });
    expect(despues).toMatchObject({ estado: "liberado", pago: { resultado: "coincide" } });
    expect(estado.pagos).toHaveLength(1);
    expect(bitacora.map((entrada) => entrada.tipo)).toEqual([
      "cobro.creado", "intento.reservado", "pey.llamada", "intento.creado", "pago.verificado", "cobro.liberado",
    ]);
    expect(bitacora.map((entrada) => entrada.seq)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(vistaBitacora.page.map((entrada) => entrada.tipo)).toEqual(bitacora.map((entrada) => entrada.tipo));
    expect(vistaBitacora.page.map((entrada) => entrada.seq)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(outbound).not.toHaveBeenCalled();
  });

  it("reuses a create idempotency key and rejects a changed payload", async () => {
    const t = nuevoHarness();
    const original = await crearCobro(t, "demo-idempotencia-000001");
    const repetido = await crearCobro(t, "demo-idempotencia-000001");
    expect(repetido).toEqual(original);
    await terminarTrabajos(t);
    const estado = await leerEstado(t);
    expect(estado.cobros).toHaveLength(1);
    expect(estado.cobros[0].folio).toBe(original.folio);
    expect(estado.intentos).toHaveLength(1);
    expect(estado.bitacora.filter((entrada) => entrada.tipo === "intento.reservado")).toHaveLength(1);
    expect(estado.bitacora.filter((entrada) => entrada.tipo === "pey.llamada")).toHaveLength(1);

    await esperarCodigo(crearCobro(t, "demo-idempotencia-000001", 14901), "CLAVE_REUTILIZADA");
  });

  it("does not duplicate a repeated simulation or let one transaction release another cobro", async () => {
    const t = nuevoHarness();
    const primero = await crearCobro(t, "demo-replay-tx-0000001");
    await terminarTrabajos(t);
    await t.mutation(api.demo.simularPago, { publicId: primero.publicId, variante: "exacto" });
    await terminarTrabajos(t);
    await t.mutation(api.demo.simularPago, { publicId: primero.publicId, variante: "exacto" });
    await terminarTrabajos(t);

    const segundo = await crearCobro(t, "demo-replay-tx-0000002");
    await terminarTrabajos(t);
    const estado = await leerEstado(t);
    const intentoSegundo = estado.intentos.find((intento) => intento.cobroId === estado.cobros.find((c) => c.publicId === segundo.publicId)?._id);
    const transaccionPrimera = estado.transacciones[0];
    expect(intentoSegundo?.peyPayableId).toBeTruthy();
    expect(transaccionPrimera).toBeTruthy();

    await esperarCodigo(t.mutation(internal.motor.verificar.aplicarEvidencia, {
      intentoId: intentoSegundo!._id,
      origen: "simulador",
      evidencia: {
        destinoConfirmado: true,
        transacciones: [{
          transactionId: transaccionPrimera!.transactionId,
          status: transaccionPrimera!.status,
          amount: transaccionPrimera!.amount,
          amountBreakdown: transaccionPrimera!.amountBreakdown,
          currency: transaccionPrimera!.currency,
          paymentMethod: transaccionPrimera!.paymentMethod,
          payableType: transaccionPrimera!.payableType as "API_CODI_QR",
          payableId: intentoSegundo!.peyPayableId!,
          dateCreated: transaccionPrimera!.dateCreated,
          ...(transaccionPrimera!.datePaid ? { datePaid: transaccionPrimera!.datePaid } : {}),
          metadata: transaccionPrimera!.metadata,
        }],
      },
    }), "CLAVE_REUTILIZADA");

    const final = await leerEstado(t);
    expect(final.pagos).toHaveLength(1);
    expect(final.cobros.find((c) => c.publicId === primero.publicId)?.estado).toBe("liberado");
    expect(final.cobros.find((c) => c.publicId === segundo.publicId)?.estado).toBe("esperando_pago");
    expect(final.bitacora.filter((entrada) => entrada.tipo === "cobro.liberado")).toHaveLength(1);
  });

  it("keeps only paid payable transactions from partial-link evidence and later recognises a pending id", async () => {
    const t = nuevoHarness();
    const cobro = await t.mutation(api.cobros.crear, {
      claveIdempotencia: "demo-partial-link-000001",
      concepto: "Pedido de ejemplo",
      montoCentavos: 14900,
      tipo: "link",
    });
    await terminarTrabajos(t);
    const initial = await leerEstado(t);
    const intento = initial.intentos.find((item) => item.cobroId === initial.cobros.find((item) => item.publicId === cobro.publicId)?._id)!;
    const link = {
      status: "partial" as const,
      amount: 149,
      clientReferenceId: intento.publicId,
      metadata: {},
      transactions: [{ transactionId: "partial-paid-0001" }, { transactionId: "partial-pending-0001" }],
    };
    const pagada = {
      transactionId: "partial-paid-0001",
      status: "PAID" as const,
      amount: 149,
      amountBreakdown: { base: 149, fee: 0, tip: 0 },
      currency: "MXN",
      paymentMethod: "CODI" as const,
      payableType: "PAYMENT_LINK" as const,
      payableId: intento.peyPayableId!,
      dateCreated: "2026-11-14T11:00:00.000Z",
      datePaid: "2026-11-14T11:01:00.000Z",
      metadata: {},
    };
    const pendiente = {
      ...pagada,
      transactionId: "partial-pending-0001",
      status: "PENDING" as const,
      datePaid: undefined,
    };
    const ajena = { ...pagada, transactionId: "partial-other-payable-0001", payableId: "another-payable" };
    const primeraEvidencia = { link, transacciones: [pagada, pendiente, ajena] };

    await expect(t.mutation(internal.motor.verificar.aplicarEvidencia, {
      intentoId: intento._id,
      origen: "sondeo",
      evidencia: primeraEvidencia,
    })).resolves.toEqual({ ok: true, resultado: "parcial" });

    let estado = await leerEstado(t);
    expect(estado.pagos).toHaveLength(1);
    expect(estado.pagos[0]?.peyTransactionId).toBe(pagada.transactionId);
    expect(estado.pagos.some((pago) => pago.peyTransactionId === pendiente.transactionId || pago.peyTransactionId === ajena.transactionId)).toBe(false);
    expect(estado.cobros.find((item) => item.publicId === cobro.publicId)).toMatchObject({ estado: "en_revision", motivoRevision: "parcial" });

    const pendientePagada = { ...pendiente, status: "PAID" as const, datePaid: "2026-11-14T11:02:00.000Z" };
    await expect(t.mutation(internal.motor.verificar.aplicarEvidencia, {
      intentoId: intento._id,
      origen: "sondeo",
      evidencia: { link, transacciones: [pagada, pendientePagada, ajena] },
    })).resolves.toEqual({ ok: true, resultado: "parcial" });

    estado = await leerEstado(t);
    expect(estado.pagos.map((pago) => pago.peyTransactionId).sort()).toEqual([pagada.transactionId, pendientePagada.transactionId].sort());
    expect(estado.pagos.every((pago) => pago.resultado === "parcial")).toBe(true);
    expect(estado.cobros.find((item) => item.publicId === cobro.publicId)).toMatchObject({ estado: "en_revision", motivoRevision: "parcial" });
  });

  it("persists the payment that completes a partial link when the next read is paid", async () => {
    const t = nuevoHarness();
    const cobro = await t.mutation(api.cobros.crear, {
      claveIdempotencia: "demo-partial-cierra-0001",
      concepto: "Pedido de ejemplo",
      montoCentavos: 14900,
      tipo: "link",
    });
    await terminarTrabajos(t);
    const initial = await leerEstado(t);
    const intento = initial.intentos.find((item) => item.cobroId === initial.cobros.find((item) => item.publicId === cobro.publicId)?._id)!;
    const pagada = {
      transactionId: "cierra-paid-0001",
      status: "PAID" as const,
      amount: 149,
      amountBreakdown: { base: 149, fee: 0, tip: 0 },
      currency: "MXN",
      paymentMethod: "CODI" as const,
      payableType: "PAYMENT_LINK" as const,
      payableId: intento.peyPayableId!,
      dateCreated: "2026-11-14T11:00:00.000Z",
      datePaid: "2026-11-14T11:01:00.000Z",
      metadata: {},
    };
    const pendiente = {
      ...pagada,
      transactionId: "cierra-pending-0001",
      status: "PENDING" as const,
      datePaid: undefined,
    };
    const ajena = { ...pagada, transactionId: "cierra-other-payable-0001", payableId: "another-payable" };
    const linkParcial = {
      status: "partial" as const,
      amount: 149,
      clientReferenceId: intento.publicId,
      metadata: {},
      transactions: [{ transactionId: pagada.transactionId }, { transactionId: pendiente.transactionId }],
    };

    await expect(t.mutation(internal.motor.verificar.aplicarEvidencia, {
      intentoId: intento._id,
      origen: "sondeo",
      evidencia: { link: linkParcial, transacciones: [pagada, pendiente, ajena] },
    })).resolves.toEqual({ ok: true, resultado: "parcial" });

    const pendientePagada = { ...pendiente, status: "PAID" as const, datePaid: "2026-11-14T11:02:00.000Z" };
    const evidenciaCierre = {
      link: { ...linkParcial, status: "paid" as const },
      transacciones: [pagada, pendientePagada, ajena],
    };
    await expect(t.mutation(internal.motor.verificar.aplicarEvidencia, {
      intentoId: intento._id,
      origen: "sondeo",
      evidencia: evidenciaCierre,
    })).resolves.toEqual({ ok: true, resultado: "duplicado" });

    let estado = await leerEstado(t);
    expect(estado.pagos.map((pago) => pago.peyTransactionId).sort()).toEqual([pagada.transactionId, pendientePagada.transactionId].sort());
    expect(estado.pagos.find((pago) => pago.peyTransactionId === pendientePagada.transactionId)?.resultado).toBe("duplicado");
    expect(estado.cobros.find((item) => item.publicId === cobro.publicId)).toMatchObject({
      estado: "en_revision",
      motivoRevision: "parcial",
    });
    expect(estado.negocios[0]?.enRevisionCount).toBe(1);
    expect(estado.bitacora.filter((entrada) => entrada.tipo === "cobro.en_revision")).toHaveLength(1);
    expect(estado.bitacora.some((entrada) => entrada.tipo === "cobro.liberado" || entrada.tipo === "pago.verificado")).toBe(false);
    expect(estado.bitacora.some((entrada) => entrada.tipo === "pago.no_coincide" && entrada.detalle.motivo === "duplicado")).toBe(true);

    await expect(t.mutation(internal.motor.verificar.aplicarEvidencia, {
      intentoId: intento._id,
      origen: "sondeo",
      evidencia: evidenciaCierre,
    })).resolves.toEqual({ ok: true, resultado: "repetido" });

    estado = await leerEstado(t);
    expect(estado.pagos).toHaveLength(2);
    expect(estado.cobros.find((item) => item.publicId === cobro.publicId)?.estado).toBe("en_revision");
  });

  it("persists a new counted payment while the cobro is already in review for another reason", async () => {
    const t = nuevoHarness();
    const cobro = await t.mutation(api.cobros.crear, {
      claveIdempotencia: "demo-revision-otra-0001",
      concepto: "Pedido de ejemplo",
      montoCentavos: 14900,
      tipo: "link",
    });
    await terminarTrabajos(t);
    const initial = await leerEstado(t);
    const intento = initial.intentos.find((item) => item.cobroId === initial.cobros.find((item) => item.publicId === cobro.publicId)?._id)!;
    const distinta = {
      transactionId: "revision-distinta-0001",
      status: "PAID" as const,
      amount: 150,
      amountBreakdown: { base: 150, fee: 0, tip: 0 },
      currency: "MXN",
      paymentMethod: "CODI" as const,
      payableType: "PAYMENT_LINK" as const,
      payableId: intento.peyPayableId!,
      dateCreated: "2026-11-14T11:00:00.000Z",
      datePaid: "2026-11-14T11:01:00.000Z",
      metadata: {},
    };
    const link = {
      status: "paid" as const,
      amount: 149,
      clientReferenceId: intento.publicId,
      metadata: {},
      transactions: [{ transactionId: distinta.transactionId }],
    };
    await expect(t.mutation(internal.motor.verificar.aplicarEvidencia, {
      intentoId: intento._id,
      origen: "sondeo",
      evidencia: { link, transacciones: [distinta] },
    })).resolves.toEqual({ ok: true, resultado: "monto_distinto" });

    const exacta = {
      ...distinta,
      transactionId: "revision-exacta-0001",
      amount: 149,
      amountBreakdown: { base: 149, fee: 0, tip: 0 },
      datePaid: "2026-11-14T11:03:00.000Z",
    };
    await expect(t.mutation(internal.motor.verificar.aplicarEvidencia, {
      intentoId: intento._id,
      origen: "sondeo",
      evidencia: {
        link: {
          ...link,
          transactions: [{ transactionId: distinta.transactionId }, { transactionId: exacta.transactionId }],
        },
        transacciones: [distinta, exacta],
      },
    })).resolves.toEqual({ ok: true, resultado: "duplicado" });

    const estado = await leerEstado(t);
    expect(estado.pagos.map((pago) => pago.peyTransactionId).sort()).toEqual([distinta.transactionId, exacta.transactionId].sort());
    expect(estado.cobros.find((item) => item.publicId === cobro.publicId)).toMatchObject({
      estado: "en_revision",
      motivoRevision: "monto_distinto",
    });
    expect(estado.bitacora.some((entrada) => entrada.tipo === "cobro.liberado")).toBe(false);
  });

  it.each(["identical", "metadata order", "amount", "metadata", "dateCreated"])("claims repeated link evidence safely: %s", async (difference) => {
    const t = nuevoHarness();
    await t.mutation(api.cobros.crear, {
      claveIdempotencia: "duplicate-link-id-0001", concepto: "Pedido de ejemplo", montoCentavos: 14900, tipo: "link",
    });
    await terminarTrabajos(t);
    const { intentos } = await leerEstado(t);
    const intento = intentos[0];
    const tx = {
      transactionId: "duplicate-link-payment", status: "PAID" as const, amount: 149,
      amountBreakdown: { base: 149, tip: 0, fee: 0 }, currency: "MXN", paymentMethod: "CODI" as const,
      payableType: "PAYMENT_LINK" as const, payableId: intento.peyPayableId!,
      dateCreated: "2026-11-14T11:00:00.000Z", datePaid: "2026-11-14T11:01:00.000Z", metadata: {},
    };
    const first = { ...tx, metadata: { first: "example", second: "fixture" } };
    const second = {
      ...first,
      ...(difference === "metadata order" ? { metadata: { second: "fixture", first: "example" } } : {}),
      ...(difference === "amount" ? { amount: 150, amountBreakdown: { base: 150, tip: 0, fee: 0 } } : {}),
      ...(difference === "metadata" ? { metadata: { first: "different", second: "fixture" } } : {}),
      ...(difference === "dateCreated" ? { dateCreated: "2026-11-14T10:00:00.000Z" } : {}),
    };
    const clean = difference === "identical" || difference === "metadata order";
    const args = {
      intentoId: intento._id, origen: "sondeo" as const,
      evidencia: { transacciones: [first, second], link: {
        status: "paid" as const, amount: 149, clientReferenceId: intento.publicId, metadata: {},
        transactions: [{ transactionId: tx.transactionId }, { transactionId: tx.transactionId }],
      } },
    };
    await expect(t.mutation(internal.motor.verificar.aplicarEvidencia, args))
      .resolves.toEqual({ ok: true, resultado: clean ? "coincide" : "duplicado" });
    const state = await leerEstado(t);
    expect(state.pagos).toHaveLength(1);
    expect(state.cobros[0].estado).toBe(clean ? "liberado" : "en_revision");
    expect(state.bitacora.filter((row) => row.tipo === "cobro.liberado")).toHaveLength(clean ? 1 : 0);
    await expect(t.mutation(internal.motor.verificar.aplicarEvidencia, args))
      .resolves.toEqual({ ok: true, resultado: "repetido" });
    expect((await leerEstado(t)).pagos).toHaveLength(1);
  });

  it("holds a mismatched amount for review rather than releasing", async () => {
    const t = nuevoHarness();
    const cobro = await crearCobro(t, "demo-monto-distinto-0001");
    await terminarTrabajos(t);
    await t.mutation(api.demo.simularPago, { publicId: cobro.publicId, variante: "monto_distinto" });
    await terminarTrabajos(t);

    const detalle = await t.query(api.cobros.obtener, { publicId: cobro.publicId });
    const estado = await leerEstado(t);
    expect(detalle).toMatchObject({ estado: "en_revision", pago: { resultado: "monto_distinto" } });
    expect(estado.bitacora.some((entrada) => entrada.tipo === "cobro.liberado")).toBe(false);
  });

  it("refuses LIVE operations without an owner and keeps simulation DEMO-only", async () => {
    vi.stubEnv("PAYVRO_MODE", "live");
    const t = nuevoHarness();
    await t.run(async (ctx) => ctx.db.insert("negocios", {
      publicId: "neg_test_live",
      nombre: "Dulces Ana — Ejemplo",
      giro: "social",
      colorMarca: "#076B76",
      modo: "live",
      cobrosPausados: false,
      folioSiguiente: 1,
      seqBitacora: 0,
    }));

    await esperarCodigo(crearCobro(t, "demo-live-sin-dueno-0001"), "NO_AUTORIZADO");
    const autorizado = t.withIdentity({ email: "owner@example.invalid", emailVerified: true });
    await expect(autorizado.query(api.negocio.obtener, {})).resolves.toMatchObject({ modo: "live" });
    await esperarCodigo(autorizado.mutation(api.demo.simularPago, {
      publicId: "cob_00000000000000000000000000000000",
      variante: "exacto",
    }), "SOLO_DEMO");
  });

  it("rejects a direct purge in LIVE while allowing the empty DEMO purge", async () => {
    const demo = nuevoHarness();
    await expect(demo.mutation(internal.motor.purga.purgarDemo, { tabla: "bitacora" })).resolves.toEqual({
      eliminados: 0,
      completado: true,
    });

    vi.stubEnv("PAYVRO_MODE", "live");
    const live = nuevoHarness();
    await esperarCodigo(live.mutation(internal.motor.purga.purgarDemo, { tabla: "bitacora" }), "SOLO_DEMO");
  });
});
