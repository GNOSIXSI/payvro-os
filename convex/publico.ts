import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { modo } from "./puertos";
import { esId, nuevoId } from "@payvro/engine/ids";
import { consumirLimite } from "./motor/limites";

const modoInstalacion = v.union(v.literal("demo"), v.literal("live"));

export const instalacion = query({
  args: {},
  returns: v.object({ modo: modoInstalacion }),
  handler: async () => ({ modo: modo() }),
});

const estadoVisible = (estado: string): string => {
  switch (estado) {
    case "pagado_verificado":
    case "liberado": return "Pago verificado";
    case "en_revision": return "Estamos revisando tu pago";
    case "expirado":
    case "cancelado": return "Este cobro ya no está disponible";
    default: return "Esperando pago";
  }
};
const proyeccionPublica = v.object({
  negocio: v.object({ nombre: v.string(), colorMarca: v.string() }), folio: v.number(), concepto: v.string(),
  montoCentavos: v.number(), estadoVisible: v.string(), qrString: v.optional(v.string()),
  urlPago: v.optional(v.string()), modo: v.union(v.literal("demo"), v.literal("live")),
});

export const cobro = query({
  args: { publicId: v.string() },
  returns: v.union(v.null(), proyeccionPublica),
  handler: async (ctx, args) => {
    if (!esId("cob_", args.publicId)) return null;
    const cobro = await ctx.db.query("cobros").withIndex("by_publicId", (q) => q.eq("publicId", args.publicId)).unique();
    if (!cobro) return null;
    const instalacionModo = modo();
    if (cobro.modo !== instalacionModo) {
      throw new ConvexError({ codigo: "MODO_INVALIDO", mensaje: "El modo del negocio no coincide con la instalación." });
    }
    const negocio = await ctx.db.get(cobro.negocioId);
    if (!negocio || negocio.modo !== cobro.modo) {
      throw new ConvexError({ codigo: "MODO_INVALIDO", mensaje: "El modo del negocio no coincide con la instalación." });
    }
    const intentoGuardado = cobro.intentoActivoId ? await ctx.db.get(cobro.intentoActivoId) : null;
    const intento = intentoGuardado && intentoGuardado.negocioId === cobro.negocioId && intentoGuardado.cobroId === cobro._id && intentoGuardado.modo === cobro.modo ? intentoGuardado : null;
    return {
      negocio: { nombre: negocio.nombre, colorMarca: negocio.colorMarca }, folio: cobro.folio,
      concepto: cobro.concepto, montoCentavos: cobro.montoCentavos, estadoVisible: estadoVisible(cobro.estado),
      ...(intento?.qrString ? { qrString: intento.qrString } : {}),
      ...(intento?.urlPago ? { urlPago: intento.urlPago } : {}), modo: cobro.modo,
    };
  },
});

export const vigilar = mutation({
  args: { publicId: v.string() },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args) => {
    if (!esId("cob_", args.publicId)) return { ok: false };
    const cobro = await ctx.db.query("cobros").withIndex("by_publicId", (q) => q.eq("publicId", args.publicId)).unique();
    if (!cobro) return { ok: false };
    if (cobro.modo !== modo()) {
      throw new ConvexError({ codigo: "MODO_INVALIDO", mensaje: "El modo del negocio no coincide con la instalación." });
    }
    if (cobro.estado !== "esperando_pago" || !cobro.intentoActivoId) return { ok: false };
    const negocio = await ctx.db.get(cobro.negocioId);
    const intento = await ctx.db.get(cobro.intentoActivoId);
    if (!negocio || !intento || intento.negocioId !== negocio._id || intento.cobroId !== cobro._id || negocio.modo !== cobro.modo) return { ok: false };
    await consumirLimite(ctx, `vigilar:${cobro.publicId}`, 60);
    const ahora = Date.now();
    const vigiladoHasta = ahora + 30_000;
    if (negocio.modo !== "live" || intento.tipo !== "qr" || intento.estado !== "creado") {
      await ctx.db.patch(intento._id, { vigiladoHasta });
      return { ok: true };
    }
    const inicio = intento.sondeoInicioEn ?? ahora;
    if (ahora - inicio >= 15 * 60 * 1000) {
      await ctx.db.patch(intento._id, { vigiladoHasta, sondeoActivo: false, sondeoLeaseHasta: undefined, sondeoLeaseId: undefined, sondeoInicioEn: inicio });
      return { ok: true };
    }
    const leaseVigente = intento.sondeoActivo && intento.sondeoLeaseId !== undefined && (intento.sondeoLeaseHasta ?? 0) > ahora;
    if (leaseVigente) {
      await ctx.db.patch(intento._id, { vigiladoHasta });
      return { ok: true };
    }
    const leaseId = nuevoId("evt_");
    await ctx.db.patch(intento._id, {
      vigiladoHasta,
      sondeoActivo: true,
      sondeoInicioEn: inicio,
      sondeoLeaseHasta: ahora + 60_000,
      sondeoLeaseId: leaseId,
      sondeoBackoffMs: intento.sondeoBackoffMs ?? 1_800,
    });
    await ctx.scheduler.runAfter(0, internal.motor.verificar.tickSondeo, { intentoId: intento._id, leaseId });
    return { ok: true };
  },
});
