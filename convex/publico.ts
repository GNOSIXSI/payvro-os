// STUB WP-OS-01 — replaced by WP-OS-02
import { ConvexError, v } from "convex/values";
import { COBROS_FIXTURE, NEGOCIO_FIXTURE, QR_STRING_FIXTURE } from "./_stub/fixtures";
import { mutation, query } from "./_generated/server";

const estadoVisible = (estado: (typeof COBROS_FIXTURE)[number]["estado"]): string => {
  switch (estado) {
    case "esperando_pago":
      return "Esperando pago";
    case "pagado_verificado":
    case "liberado":
      return "Pago verificado";
    case "en_revision":
      return "Estamos revisando tu pago";
  }
};

const cobroPublicoValidator = v.object({
  negocio: v.object({
    nombre: v.string(),
    colorMarca: v.string(),
  }),
  folio: v.number(),
  concepto: v.string(),
  montoCentavos: v.number(),
  estadoVisible: v.string(),
  qrString: v.optional(v.string()),
  urlPago: v.optional(v.string()),
  modo: v.union(v.literal("demo"), v.literal("live")),
});

export const cobro = query({
  args: { publicId: v.string() },
  returns: v.union(v.null(), cobroPublicoValidator),
  handler: async (_ctx, args) => {
    const registro = COBROS_FIXTURE.find((candidato) => candidato.publicId === args.publicId);
    if (!registro) {
      return null;
    }

    return {
      negocio: {
        nombre: NEGOCIO_FIXTURE.nombre,
        colorMarca: NEGOCIO_FIXTURE.colorMarca,
      },
      folio: registro.folio,
      concepto: registro.concepto,
      montoCentavos: registro.montoCentavos,
      estadoVisible: estadoVisible(registro.estado),
      qrString: QR_STRING_FIXTURE,
      modo: NEGOCIO_FIXTURE.modo,
    };
  },
});

export const vigilar = mutation({
  args: { publicId: v.string() },
  returns: v.object({ ok: v.boolean() }),
  handler: async () => {
    throw new ConvexError({
      codigo: "NO_IMPLEMENTADO",
      mensaje: "El seguimiento de cobros todavía no está disponible.",
    });
  },
});
