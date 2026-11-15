import { convexTest, type TestConvex } from "convex-test";
import type { Id } from "../../convex/_generated/dataModel";
import { nuevoId } from "../../packages/engine/src/ids";
import schema from "../../convex/schema";

export const BANK_ID = "01BBBBBBBBBBBBBBBBBBBBBBBB";
export const QR_ID = "AB12CD34EF";
export const TX_ID = "01AAAAAAAAAAAAAAAAAAAAAAAA";

export function nuevoLiveHarness(): TestConvex<typeof schema> {
  return convexTest(schema, import.meta.glob("../../convex/**/*.ts"));
}

export async function insertarNegocioLive(t: TestConvex<typeof schema>): Promise<Id<"negocios">> {
  return t.run(async (ctx) => ctx.db.insert("negocios", {
    publicId: "neg_live_test",
    nombre: "Dulces Ana — Ejemplo",
    giro: "social",
    colorMarca: "#076B76",
    modo: "live",
    cobrosPausados: false,
    folioSiguiente: 1,
    seqBitacora: 0,
    estadoCuentaPey: "ACTIVE",
    cuentaRevisadaEn: Date.now(),
  }));
}

export async function insertarIntentoLive(
  t: TestConvex<typeof schema>,
  negocioId: Id<"negocios">,
  options: { estado?: "creado" | "descartado"; ageMs?: number; payableId?: string } = {},
): Promise<{ cobroId: Id<"cobros">; intentoId: Id<"intentos">; cobroPublicId: string }> {
  const now = Date.now();
  const ageMs = options.ageMs ?? 60_000;
  return t.run(async (ctx) => {
    const cobroPublicId = nuevoId("cob_");
    const cobroId = await ctx.db.insert("cobros", {
      negocioId,
      modo: "live",
      publicId: cobroPublicId,
      folio: 1,
      plantilla: "pedido",
      concepto: "Pedido de ejemplo",
      montoCentavos: 1,
      tipoInicial: "qr",
      moneda: "MXN",
      estado: options.estado === "descartado" ? "cancelado" : "esperando_pago",
      expiraEn: now + 24 * 60 * 60 * 1000,
      claveIdempotencia: `live-cobro-key-${String(ageMs).padStart(8, "0")}`,
      creadoPor: { tipo: "dueno", id: "owner-example" },
      creadoEn: now - ageMs,
      actualizadoEn: now - ageMs,
    });
    const intentoId = await ctx.db.insert("intentos", {
      negocioId,
      modo: "live",
      publicId: nuevoId("int_"),
      cobroId,
      tipo: "qr",
      estado: options.estado ?? "creado",
      montoCentavos: 1,
      peyPayableId: options.payableId ?? QR_ID,
      destino: "bank_account_id",
      sondeoActivo: false,
      sondeos: 0,
      barridoActivo: true,
      siguienteBarridoEn: now - 1,
      claveIdempotencia: `live-intento-key-${String(ageMs).padStart(8, "0")}`,
      creadoEn: now - ageMs,
    });
    await ctx.db.patch(cobroId, { intentoActivoId: intentoId });
    return { cobroId, intentoId, cobroPublicId };
  });
}

export function transaccionWire(transactionId: string, overrides: Record<string, unknown> = {}) {
  return {
    id: transactionId,
    status: "PAID",
    amount: 0.01,
    amountBreakdown: { base: 0.01, tip: 0, fee: 0 },
    currency: "MXN",
    paymentMethod: "CODI",
    payableType: "API_CODI_QR",
    payableId: QR_ID,
    dateCreated: 1_704_067_200,
    datePaid: 1_704_067_260,
    metadata: {
      trackingKey: "TRACKING-EXAMPLE",
      externalMetadata: { payvro_cobro: "cob_test", payvro_intento: "int_test", payvro_modo: "live" },
    },
    ...overrides,
  };
}

export function respuestaJson(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
