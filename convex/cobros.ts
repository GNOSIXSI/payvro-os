// STUB WP-OS-01 — replaced by WP-OS-02
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import {
  COBROS_FIXTURE,
  QR_STRING_FIXTURE,
  RESUMEN_FIXTURE,
} from "./_stub/fixtures";
import { mutation, query } from "./_generated/server";

const estadoCobroValidator = v.union(
  v.literal("borrador"),
  v.literal("esperando_pago"),
  v.literal("pagado_verificado"),
  v.literal("liberado"),
  v.literal("expirado"),
  v.literal("cancelado"),
  v.literal("en_revision"),
);

const estadoIntentoValidator = v.union(
  v.literal("reservado"),
  v.literal("creado"),
  v.literal("pagado"),
  v.literal("incierto"),
  v.literal("fallido"),
  v.literal("descartado"),
);

const cobroListaValidator = v.object({
  publicId: v.string(),
  folio: v.number(),
  concepto: v.string(),
  montoCentavos: v.number(),
  estado: estadoCobroValidator,
  alerta: v.optional(v.literal("pago_duplicado")),
  creadoEn: v.number(),
});

const resultadoPagoValidator = v.union(
  v.literal("coincide"),
  v.literal("monto_distinto"),
  v.literal("destino_distinto"),
  v.literal("metodo_no_permitido"),
  v.literal("con_propina"),
  v.literal("duplicado"),
  v.literal("pago_tardio"),
  v.literal("parcial"),
);

const cobroDetalleValidator = v.object({
  publicId: v.string(),
  folio: v.number(),
  concepto: v.string(),
  montoCentavos: v.number(),
  estado: estadoCobroValidator,
  alerta: v.optional(v.literal("pago_duplicado")),
  creadoEn: v.number(),
  expiraEn: v.number(),
  intentoActivo: v.union(
    v.null(),
    v.object({
      publicId: v.string(),
      tipo: v.union(v.literal("link"), v.literal("qr")),
      estado: estadoIntentoValidator,
      montoCentavos: v.number(),
      qrString: v.optional(v.string()),
      urlPago: v.optional(v.string()),
    }),
  ),
  pago: v.union(
    v.null(),
    v.object({
      publicId: v.string(),
      resultado: resultadoPagoValidator,
      metodo: v.union(v.literal("CODI"), v.literal("CARD")),
      baseCentavos: v.number(),
      totalCentavos: v.number(),
      pagadoEn: v.number(),
    }),
  ),
});

export const crear = mutation({
  args: {
    claveIdempotencia: v.string(),
    concepto: v.string(),
    montoCentavos: v.number(),
    tipo: v.optional(v.union(v.literal("link"), v.literal("qr"))),
  },
  returns: v.object({
    publicId: v.string(),
    folio: v.number(),
    estado: estadoCobroValidator,
  }),
  handler: async () => {
    throw new ConvexError({
      codigo: "NO_IMPLEMENTADO",
      mensaje: "La creación de cobros todavía no está disponible.",
    });
  },
});

export const listar = query({
  args: {
    estado: v.optional(estadoCobroValidator),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(cobroListaValidator),
  handler: async (_ctx, args) => {
    const registros = [];

    for (const cobro of COBROS_FIXTURE) {
      if (args.estado && cobro.estado !== args.estado) {
        continue;
      }
      registros.push(cobro);
    }

    const cursor = args.paginationOpts.cursor;
    const parsedOffset = cursor === null ? 0 : Number(cursor);
    const offset = Number.isSafeInteger(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0;
    const limit = Math.max(1, args.paginationOpts.numItems);
    const page = registros.slice(offset, offset + limit);
    const nextOffset = offset + page.length;

    return {
      page,
      isDone: nextOffset >= registros.length,
      continueCursor: String(nextOffset),
      splitCursor: null,
      pageStatus: null,
    };
  },
});

export const obtener = query({
  args: { publicId: v.string() },
  returns: v.union(v.null(), cobroDetalleValidator),
  handler: async (_ctx, args) => {
    const cobro = COBROS_FIXTURE.find((registro) => registro.publicId === args.publicId);
    if (!cobro) {
      return null;
    }

    const intentoActivo = {
      publicId: `int_${String(cobro.folio).padStart(26, "0")}`,
      tipo: "qr" as const,
      estado: cobro.estado === "esperando_pago" ? ("creado" as const) : ("pagado" as const),
      montoCentavos: cobro.montoCentavos,
      qrString: QR_STRING_FIXTURE,
    };
    const pago =
      cobro.estado === "pagado_verificado" || cobro.estado === "liberado" || cobro.estado === "en_revision"
        ? {
            publicId: `pag_${String(cobro.folio).padStart(26, "0")}`,
            resultado: cobro.estado === "en_revision" ? "duplicado" : "coincide",
            metodo: "CODI" as const,
            baseCentavos: cobro.montoCentavos,
            totalCentavos: cobro.montoCentavos,
            pagadoEn: cobro.creadoEn,
          }
        : null;

    return {
      ...cobro,
      expiraEn: cobro.creadoEn + 24 * 60 * 60 * 1000,
      intentoActivo,
      pago,
    };
  },
});

export const resumenDelDia = query({
  args: {},
  returns: v.object({
    verificadoHoyCentavos: v.number(),
    porLiberar: v.number(),
    enRevision: v.number(),
  }),
  handler: async () => RESUMEN_FIXTURE,
});

export const cancelar = mutation({
  args: {
    publicId: v.string(),
    claveIdempotencia: v.string(),
  },
  returns: v.object({ estado: estadoCobroValidator }),
  handler: async () => {
    throw new ConvexError({
      codigo: "NO_IMPLEMENTADO",
      mensaje: "La cancelación de cobros todavía no está disponible.",
    });
  },
});

export const reintentar = mutation({
  args: {
    publicId: v.string(),
    claveIdempotencia: v.string(),
  },
  returns: v.object({
    publicId: v.string(),
    estado: estadoIntentoValidator,
  }),
  handler: async () => {
    throw new ConvexError({
      codigo: "NO_IMPLEMENTADO",
      mensaje: "El reintento de cobros todavía no está disponible.",
    });
  },
});
