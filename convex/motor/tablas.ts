import { defineTable } from "convex/server";
import { v } from "convex/values";

const modo = v.union(v.literal("demo"), v.literal("live"));
const cobroEstado = v.union(
  v.literal("borrador"), v.literal("esperando_pago"), v.literal("pagado_verificado"),
  v.literal("liberado"), v.literal("expirado"), v.literal("cancelado"), v.literal("en_revision"),
);
const intentoEstado = v.union(
  v.literal("reservado"), v.literal("creado"), v.literal("pagado"),
  v.literal("incierto"), v.literal("fallido"), v.literal("descartado"),
);
const detalleBitacora = v.object({
  folio: v.optional(v.number()),
  montoCentavos: v.optional(v.number()),
  tipo: v.optional(v.union(v.literal("qr"), v.literal("link"))),
  operacion: v.optional(v.union(v.literal("crear_qr"), v.literal("crear_link"))),
  causa: v.optional(v.union(v.literal("timeout"), v.literal("red"), v.literal("5xx"))),
  httpStatus: v.optional(v.number()),
  motivo: v.optional(v.union(
    v.literal("monto_distinto"), v.literal("destino_distinto"), v.literal("metodo_no_permitido"),
    v.literal("con_propina"), v.literal("duplicado"), v.literal("pago_tardio"), v.literal("parcial"), v.literal("incierto_60s"), v.literal("cobro_cancelado"), v.literal("cobro_expirado"),
  )),
  origen: v.optional(v.literal("simulador")),
  pausados: v.optional(v.boolean()),
});

export const tablasMotor = {
  negocios: defineTable({
    publicId: v.string(), nombre: v.string(), giro: v.string(), colorMarca: v.string(), modo,
    cobrosPausados: v.boolean(), folioSiguiente: v.number(), seqBitacora: v.number(),
    ultimoTxVisto: v.optional(v.string()), enRevisionCount: v.optional(v.number()),
    verificadoHoyDia: v.optional(v.number()), verificadoHoyCentavos: v.optional(v.number()),
  }).index("by_publicId", ["publicId"]).index("by_modo", ["modo"]),
  cobros: defineTable({
    negocioId: v.id("negocios"), modo, publicId: v.string(), folio: v.number(), plantilla: v.string(),
    concepto: v.string(), montoCentavos: v.number(), tipoInicial: v.optional(v.union(v.literal("qr"), v.literal("link"))),
    moneda: v.literal("MXN"), estado: cobroEstado,
    motivoRevision: v.optional(v.string()), alerta: v.optional(v.literal("pago_duplicado")),
    intentoActivoId: v.optional(v.id("intentos")), pagoId: v.optional(v.id("pagos")), expiraEn: v.number(),
    claveIdempotencia: v.string(), claveCancelacion: v.optional(v.string()), creadoPor: v.object({ tipo: v.string(), id: v.optional(v.string()) }),
    creadoEn: v.number(), actualizadoEn: v.number(), verificadoEn: v.optional(v.number()), liberadoEn: v.optional(v.number()),
  })
    .index("by_publicId", ["publicId"])
    .index("by_negocio", ["negocioId"])
    .index("by_negocio_estado", ["negocioId", "estado"])
    .index("by_negocio_creadoEn", ["negocioId", "creadoEn"])
    .index("by_negocio_clave", ["negocioId", "claveIdempotencia"])
    .index("by_negocio_cancelClave", ["negocioId", "claveCancelacion"])
    .index("by_estado_expiraEn", ["estado", "expiraEn"]),
  intentos: defineTable({
    negocioId: v.id("negocios"), modo, publicId: v.string(), cobroId: v.id("cobros"),
    tipo: v.union(v.literal("link"), v.literal("qr")), estado: intentoEstado, montoCentavos: v.number(),
    peyPayableId: v.optional(v.string()), urlPago: v.optional(v.string()), qrString: v.optional(v.string()),
    destino: v.union(v.literal("cuenta_de_la_llave"), v.literal("bank_account_id")),
    vigiladoHasta: v.optional(v.number()), sondeoActivo: v.boolean(), sondeos: v.number(),
    ultimaVerificacionEn: v.optional(v.number()), claveIdempotencia: v.string(), creadoEn: v.number(),
    postIniciadoEn: v.optional(v.number()), inciertoEn: v.optional(v.number()),
  })
    .index("by_publicId", ["publicId"])
    .index("by_cobro", ["cobroId"])
    .index("by_peyPayableId", ["peyPayableId"])
    .index("by_negocio_estado", ["negocioId", "estado"])
    .index("by_negocio_creadoEn", ["negocioId", "creadoEn"])
    .index("by_negocio_clave", ["negocioId", "claveIdempotencia"]),
  pagos: defineTable({
    negocioId: v.id("negocios"), modo, publicId: v.string(), cobroId: v.id("cobros"), intentoId: v.id("intentos"),
    peyTransactionId: v.string(), payableType: v.string(), payableId: v.string(),
    metodo: v.union(v.literal("CODI"), v.literal("CARD")), baseCentavos: v.number(), feeCentavos: v.number(),
    tipCentavos: v.number(), totalCentavos: v.number(), pagadoEn: v.number(), claveRastreo: v.optional(v.string()),
    resultado: v.union(
      v.literal("coincide"), v.literal("monto_distinto"), v.literal("destino_distinto"),
      v.literal("metodo_no_permitido"), v.literal("con_propina"), v.literal("duplicado"),
      v.literal("pago_tardio"), v.literal("parcial"),
    ), verificadoEn: v.number(),
  })
    .index("by_peyTransactionId", ["peyTransactionId"])
    .index("by_cobro", ["cobroId"])
    .index("by_negocio_verificadoEn", ["negocioId", "verificadoEn"]),
  eventosPey: defineTable({
    negocioId: v.id("negocios"), modo, publicId: v.string(), origen: v.string(), webhookId: v.optional(v.string()),
    tipo: v.string(), peyPayableId: v.optional(v.string()), peyTransactionId: v.optional(v.string()),
    hashCuerpo: v.string(), recibidoEn: v.number(), procesadoEn: v.optional(v.number()), resultado: v.optional(v.string()),
  })
    .index("by_negocio_webhookId", ["negocioId", "webhookId"])
    .index("by_recibidoEn", ["recibidoEn"])
    .index("by_negocio_recibidoEn", ["negocioId", "recibidoEn"]),
  bitacora: defineTable({
    negocioId: v.id("negocios"), modo, publicId: v.string(), seq: v.number(), tipo: v.string(),
    cobroId: v.optional(v.id("cobros")), intentoId: v.optional(v.id("intentos")),
    eventoId: v.optional(v.id("eventosPey")), pagoId: v.optional(v.id("pagos")),
    actor: v.object({ tipo: v.string(), id: v.optional(v.string()) }),
    estadoAntes: v.optional(cobroEstado), estadoDespues: v.optional(cobroEstado), detalle: detalleBitacora, en: v.number(),
  })
    .index("by_negocio_seq", ["negocioId", "seq"])
    .index("by_negocio_en", ["negocioId", "en"])
    .index("by_cobro_seq", ["cobroId", "seq"]),
  simPayables: defineTable({
    negocioId: v.id("negocios"), modo, id: v.string(), montoCentavos: v.number(), intentoPublicId: v.string(),
    tipo: v.union(v.literal("link"), v.literal("qr")), url: v.string(), qrString: v.optional(v.string()),
    simulacionVariantes: v.optional(v.array(v.union(v.literal("exacto"), v.literal("monto_distinto"), v.literal("duplicado"), v.literal("tarjeta")))),
  })
    .index("por_idSim", ["id"])
    .index("by_intento", ["intentoPublicId"])
    .index("by_negocio", ["negocioId"])
    .index("by_negocio_mode", ["negocioId", "modo"]),
  simTransacciones: defineTable({
    negocioId: v.id("negocios"), modo, payableId: v.string(), transactionId: v.string(),
    status: v.union(v.literal("PENDING"), v.literal("PAID")), amount: v.number(),
    amountBreakdown: v.object({ base: v.number(), tip: v.number(), fee: v.number() }), currency: v.string(),
    paymentMethod: v.union(v.literal("CARD"), v.literal("CODI")), payableType: v.string(),
    dateCreated: v.string(), datePaid: v.optional(v.string()), metadata: v.record(v.string(), v.string()),
  })
    .index("by_payable_business_mode", ["payableId", "negocioId", "modo"])
    .index("by_transaction", ["transactionId"])
    .index("by_negocio_mode", ["negocioId", "modo"]),
  demoLimits: defineTable({ clave: v.string(), inicio: v.number(), cantidad: v.number() })
    .index("by_clave", ["clave"])
    .index("by_inicio", ["inicio"]),
};
