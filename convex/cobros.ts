import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { peyConfiguracionDisponible, resolverNegocio, resolverNegocioEscritura } from "./puertos";
import { cancelarCobro, crearCobro, reintentarCobro } from "./motor/cobros";
import { consumirLimite } from "./motor/limites";

function limitarReserva(ctx: MutationCtx, { modo, negocioId, actor }: Awaited<ReturnType<typeof resolverNegocioEscritura>>) {
  // DEMO is anonymous; preserve its existing per-business budget. LIVE has
  // one configured issuer, and the resolver supplies the verified subject.
  const clave = modo === "demo" ? `crear:${negocioId}` : `crear:dueno:${negocioId}:${actor.id}`;
  return consumirLimite(ctx, clave, 10);
}

const estadoCobro = v.union(
  v.literal("borrador"), v.literal("esperando_pago"), v.literal("pagado_verificado"), v.literal("liberado"),
  v.literal("expirado"), v.literal("cancelado"), v.literal("en_revision"),
);
const estadoIntento = v.union(
  v.literal("reservado"), v.literal("creado"), v.literal("pagado"), v.literal("incierto"),
  v.literal("fallido"), v.literal("descartado"),
);
const resultadoPago = v.union(
  v.literal("coincide"), v.literal("monto_distinto"), v.literal("destino_distinto"),
  v.literal("metodo_no_permitido"), v.literal("con_propina"), v.literal("duplicado"),
  v.literal("pago_tardio"), v.literal("parcial"),
);
const cobroLista = v.object({
  publicId: v.string(), folio: v.number(), concepto: v.string(), montoCentavos: v.number(), estado: estadoCobro,
  alerta: v.optional(v.literal("pago_duplicado")), creadoEn: v.number(),
});
const detalleCobro = v.object({
  publicId: v.string(), folio: v.number(), concepto: v.string(), montoCentavos: v.number(), estado: estadoCobro,
  alerta: v.optional(v.literal("pago_duplicado")), creadoEn: v.number(), expiraEn: v.number(),
  intentoActivo: v.union(v.null(), v.object({
    publicId: v.string(), tipo: v.union(v.literal("link"), v.literal("qr")), estado: estadoIntento,
    montoCentavos: v.number(), qrString: v.optional(v.string()), urlPago: v.optional(v.string()),
  })),
  pago: v.union(v.null(), v.object({
    publicId: v.string(), resultado: resultadoPago, metodo: v.union(v.literal("CODI"), v.literal("CARD")),
    baseCentavos: v.number(), totalCentavos: v.number(), pagadoEn: v.number(),
  })),
});

export const crear = mutation({
  args: {
    claveIdempotencia: v.string(), concepto: v.string(), montoCentavos: v.number(),
    tipo: v.optional(v.union(v.literal("link"), v.literal("qr"))),
  },
  returns: v.object({ publicId: v.string(), folio: v.number(), estado: estadoCobro }),
  handler: async (ctx, args) => {
    const resolucion = await resolverNegocioEscritura(ctx);
    const peyConfigPresente = resolucion.modo === "live" ? peyConfiguracionDisponible() : true;
    return await crearCobro(ctx, args, resolucion.negocioId, resolucion.modo, resolucion.actor, peyConfigPresente, () => limitarReserva(ctx, resolucion));
  },
});

export const listar = query({
  args: { estado: v.optional(estadoCobro), paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(cobroLista),
  handler: async (ctx, args) => {
    const { negocioId } = await resolverNegocio(ctx);
    const consulta = args.estado
      ? ctx.db.query("cobros").withIndex("by_negocio_estado", (q) => q.eq("negocioId", negocioId).eq("estado", args.estado!)).order("desc")
      : ctx.db.query("cobros").withIndex("by_negocio", (q) => q.eq("negocioId", negocioId)).order("desc");
    const pagina = await consulta.paginate(args.paginationOpts);
    return { ...pagina, page: pagina.page.map((cobro) => ({
      publicId: cobro.publicId, folio: cobro.folio, concepto: cobro.concepto, montoCentavos: cobro.montoCentavos,
      estado: cobro.estado, ...(cobro.alerta ? { alerta: cobro.alerta } : {}), creadoEn: cobro.creadoEn,
    })) };
  },
});

export const obtener = query({
  args: { publicId: v.string() },
  returns: v.union(v.null(), detalleCobro),
  handler: async (ctx, args) => {
    const { negocioId, modo } = await resolverNegocio(ctx);
    const cobro = await ctx.db.query("cobros").withIndex("by_publicId", (q) => q.eq("publicId", args.publicId)).unique();
    if (!cobro || cobro.negocioId !== negocioId || cobro.modo !== modo) return null;
    const intento = cobro.intentoActivoId ? await ctx.db.get(cobro.intentoActivoId) : null;
    const intentoValido = intento && intento.negocioId === negocioId && intento.cobroId === cobro._id && intento.modo === modo ? intento : null;
    const pagos = cobro.pagoId
      ? await ctx.db.get(cobro.pagoId)
      : await ctx.db.query("pagos").withIndex("by_cobro", (q) => q.eq("cobroId", cobro._id)).order("desc").first();
    return {
      publicId: cobro.publicId, folio: cobro.folio, concepto: cobro.concepto, montoCentavos: cobro.montoCentavos,
      estado: cobro.estado, ...(cobro.alerta ? { alerta: cobro.alerta } : {}), creadoEn: cobro.creadoEn, expiraEn: cobro.expiraEn,
      intentoActivo: intentoValido ? {
        publicId: intentoValido.publicId, tipo: intentoValido.tipo, estado: intentoValido.estado, montoCentavos: intentoValido.montoCentavos,
        ...(intentoValido.qrString ? { qrString: intentoValido.qrString } : {}), ...(intentoValido.urlPago ? { urlPago: intentoValido.urlPago } : {}),
      } : null,
      pago: pagos && pagos.negocioId === negocioId && pagos.cobroId === cobro._id && pagos.modo === modo ? {
        publicId: pagos.publicId, resultado: pagos.resultado, metodo: pagos.metodo,
        baseCentavos: pagos.baseCentavos, totalCentavos: pagos.totalCentavos, pagadoEn: pagos.pagadoEn,
      } : null,
    };
  },
});

export const resumenDelDia = query({
  args: {},
  returns: v.object({ verificadoHoyCentavos: v.number(), porLiberar: v.number(), enRevision: v.number() }),
  handler: async (ctx) => {
    const { negocioId } = await resolverNegocio(ctx);
    const negocio = await ctx.db.get(negocioId);
    const ahora = new Date();
    const inicio = Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate());
    if (!negocio) return { verificadoHoyCentavos: 0, porLiberar: 0, enRevision: 0 };
    return {
      verificadoHoyCentavos: negocio.verificadoHoyDia === inicio ? negocio.verificadoHoyCentavos ?? 0 : 0,
      porLiberar: 0,
      enRevision: negocio.enRevisionCount ?? 0,
    };
  },
});

export const cancelar = mutation({
  args: { publicId: v.string(), claveIdempotencia: v.string() },
  returns: v.object({ estado: estadoCobro }),
  handler: async (ctx, args) => {
    const resolucion = await resolverNegocioEscritura(ctx);
    if (resolucion.modo === "demo") await consumirLimite(ctx, `cancelar:${resolucion.negocioId}`, 10);
    return await cancelarCobro(ctx, resolucion.negocioId, resolucion.modo, resolucion.actor, args.publicId, args.claveIdempotencia);
  },
});

export const reintentar = mutation({
  args: { publicId: v.string(), claveIdempotencia: v.string() },
  returns: v.object({ publicId: v.string(), estado: estadoIntento }),
  handler: async (ctx, args) => {
    const resolucion = await resolverNegocioEscritura(ctx);
    const peyConfigPresente = resolucion.modo === "live" ? peyConfiguracionDisponible() : true;
    return await reintentarCobro(ctx, resolucion.negocioId, resolucion.modo, resolucion.actor, args.publicId, args.claveIdempotencia, peyConfigPresente, () => limitarReserva(ctx, resolucion));
  },
});
