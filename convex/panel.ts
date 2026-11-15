import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import { query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { resolverNegocio } from "./puertos";

const estadoCobro = v.union(
  v.literal("borrador"), v.literal("esperando_pago"), v.literal("pagado_verificado"), v.literal("liberado"),
  v.literal("expirado"), v.literal("cancelado"), v.literal("en_revision"),
);
const actorTipo = v.union(v.literal("dueno"), v.literal("sistema"), v.literal("pey"), v.literal("agente"), v.literal("pagador"), v.literal("simulador"));
const detalle = v.object({
  motivo: v.optional(v.union(
    v.literal("monto_distinto"), v.literal("destino_distinto"), v.literal("metodo_no_permitido"),
    v.literal("con_propina"), v.literal("duplicado"), v.literal("pago_tardio"), v.literal("parcial"),
  )),
  httpStatus: v.optional(v.number()), requestId: v.optional(v.string()), conteo: v.optional(v.number()),
});
const entrada = v.object({
  publicId: v.string(), seq: v.number(), tipo: v.string(), cobroPublicId: v.string(),
  actor: v.object({ tipo: actorTipo, id: v.optional(v.string()) }),
  estadoAntes: v.optional(estadoCobro), estadoDespues: v.optional(estadoCobro), detalle, en: v.number(),
});
const motivoPublico = new Set([
  "monto_distinto", "destino_distinto", "metodo_no_permitido", "con_propina", "duplicado", "pago_tardio", "parcial",
]);

function detallePublico(valor: Record<string, unknown>) {
  return {
    ...(typeof valor.motivo === "string" && motivoPublico.has(valor.motivo) ? { motivo: valor.motivo as "monto_distinto" | "destino_distinto" | "metodo_no_permitido" | "con_propina" | "duplicado" | "pago_tardio" | "parcial" } : {}),
    ...(typeof valor.httpStatus === "number" ? { httpStatus: valor.httpStatus } : {}),
    ...(typeof valor.requestId === "string" ? { requestId: valor.requestId } : {}),
    ...(typeof valor.conteo === "number" ? { conteo: valor.conteo } : {}),
  };
}

export const bitacora = query({
  args: { cobroPublicId: v.optional(v.string()), paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(entrada),
  handler: async (ctx, args) => {
    const { negocioId, modo } = await resolverNegocio(ctx);
    let cobroId: Id<"cobros"> | undefined;
    if (args.cobroPublicId !== undefined) {
      const cobro = await ctx.db.query("cobros").withIndex("by_publicId", (q) => q.eq("publicId", args.cobroPublicId!)).unique();
      if (!cobro || cobro.negocioId !== negocioId || cobro.modo !== modo) {
        return { page: [], isDone: true, continueCursor: args.paginationOpts.cursor ?? "", splitCursor: null, pageStatus: null };
      }
      cobroId = cobro._id;
    }
    const consulta = cobroId
      ? ctx.db.query("bitacora").withIndex("by_cobro_seq", (q) => q.eq("cobroId", cobroId!)).order("asc")
      : ctx.db.query("bitacora").withIndex("by_negocio_seq", (q) => q.eq("negocioId", negocioId)).order("asc");
    const pagina = await consulta.paginate(args.paginationOpts);
    const filas = [];
    for (const fila of pagina.page) {
      if (fila.negocioId !== negocioId || !fila.cobroId) continue;
      const cobro = await ctx.db.get(fila.cobroId);
      if (!cobro || cobro.negocioId !== negocioId) continue;
      filas.push({
        publicId: fila.publicId, seq: fila.seq, tipo: fila.tipo, cobroPublicId: cobro.publicId,
        actor: fila.actor as { tipo: "dueno" | "sistema" | "pey" | "agente" | "pagador" | "simulador"; id?: string },
        ...(fila.estadoAntes ? { estadoAntes: fila.estadoAntes } : {}),
        ...(fila.estadoDespues ? { estadoDespues: fila.estadoDespues } : {}),
        detalle: detallePublico(fila.detalle as Record<string, unknown>), en: fila.en,
      });
    }
    return { ...pagina, page: filas };
  },
});
