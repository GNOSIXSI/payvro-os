// STUB WP-OS-01 — replaced by WP-OS-02
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import { BITACORA_FIXTURE } from "./_stub/fixtures";
import { query } from "./_generated/server";

const estadoCobroValidator = v.union(
  v.literal("borrador"),
  v.literal("esperando_pago"),
  v.literal("pagado_verificado"),
  v.literal("liberado"),
  v.literal("expirado"),
  v.literal("cancelado"),
  v.literal("en_revision"),
);

const actorTipoValidator = v.union(
  v.literal("dueno"),
  v.literal("sistema"),
  v.literal("pey"),
  v.literal("agente"),
  v.literal("pagador"),
  v.literal("simulador"),
);

const detalleValidator = v.object({
  motivo: v.optional(
    v.union(
      v.literal("monto_distinto"),
      v.literal("destino_distinto"),
      v.literal("metodo_no_permitido"),
      v.literal("con_propina"),
      v.literal("duplicado"),
      v.literal("pago_tardio"),
      v.literal("parcial"),
    ),
  ),
  httpStatus: v.optional(v.number()),
  requestId: v.optional(v.string()),
  conteo: v.optional(v.number()),
});

const entradaBitacoraValidator = v.object({
  publicId: v.string(),
  seq: v.number(),
  tipo: v.union(
    v.literal("cobro.creado"),
    v.literal("intento.reservado"),
    v.literal("pey.llamada"),
    v.literal("intento.creado"),
    v.literal("intento.incierto"),
    v.literal("intento.fallido"),
    v.literal("intento.descartado"),
    v.literal("evento.recibido"),
    v.literal("pago.verificado"),
    v.literal("pago.no_coincide"),
    v.literal("pago.duplicado"),
    v.literal("cobro.en_revision"),
    v.literal("cobro.liberado"),
    v.literal("cobro.expirado"),
    v.literal("cobro.cancelado"),
    v.literal("negocio.actualizado"),
    v.literal("cobros.pausados"),
  ),
  cobroPublicId: v.string(),
  actor: v.object({ tipo: actorTipoValidator, id: v.optional(v.string()) }),
  estadoAntes: v.optional(estadoCobroValidator),
  estadoDespues: v.optional(estadoCobroValidator),
  detalle: detalleValidator,
  en: v.number(),
});

export const bitacora = query({
  args: {
    cobroPublicId: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(entradaBitacoraValidator),
  handler: async (_ctx, args) => {
    const registros = [];

    for (const entrada of BITACORA_FIXTURE) {
      if (args.cobroPublicId && entrada.cobroPublicId !== args.cobroPublicId) {
        continue;
      }
      registros.push(entrada);
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
