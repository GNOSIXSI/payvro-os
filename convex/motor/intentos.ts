import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction, internalMutation } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { transicionarCobro, transicionarIntento } from "@payvro/engine";
import type { ResultadoCrear } from "@payvro/engine";
import { nuevoId } from "@payvro/engine/ids";
import { registrar } from "./bitacora";
import { crearPeyPuerto } from "./peyPuerto";

const modoValidator = v.union(v.literal("demo"), v.literal("live"));
const tipoValidator = v.union(v.literal("qr"), v.literal("link"));

export const iniciarLlamada = internalMutation({
  args: { intentoId: v.id("intentos"), modoConfigurado: modoValidator },
  returns: v.union(v.null(), v.object({
    intentoId: v.id("intentos"), negocioId: v.id("negocios"), modo: modoValidator, tipo: tipoValidator,
    intentoPublicId: v.string(), cobroPublicId: v.string(), montoCentavos: v.number(), concepto: v.string(),
    folio: v.number(), expiraEn: v.number(),
  })),
  handler: async (ctx, args) => {
    const intento = await ctx.db.get(args.intentoId);
    if (!intento || intento.estado !== "reservado" || intento.postIniciadoEn !== undefined) return null;
    const cobro = await ctx.db.get(intento.cobroId);
    const negocio = await ctx.db.get(intento.negocioId);
    if (!cobro || !negocio || cobro.estado !== "borrador" || cobro.intentoActivoId !== intento._id || cobro.modo !== intento.modo || negocio.modo !== intento.modo || args.modoConfigurado !== intento.modo) return null;
    const ahora = Date.now();
    await ctx.db.patch(intento._id, { postIniciadoEn: ahora });
    await registrar(ctx, {
      negocioId: negocio._id, modo: negocio.modo, tipo: "pey.llamada", cobroId: cobro._id, intentoId: intento._id,
      actor: { tipo: "pey" }, detalle: { operacion: intento.tipo === "qr" ? "crear_qr" : "crear_link" }, en: ahora,
    });
    return {
      intentoId: intento._id, negocioId: negocio._id, modo: negocio.modo, tipo: intento.tipo,
      intentoPublicId: intento.publicId, cobroPublicId: cobro.publicId, montoCentavos: intento.montoCentavos,
      concepto: cobro.concepto, folio: cobro.folio, expiraEn: cobro.expiraEn,
    };
  },
});

export const registrarCreado = internalMutation({
  args: {
    intentoId: v.id("intentos"), peyPayableId: v.string(), urlPago: v.optional(v.string()), qrString: v.optional(v.string()),
  },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args) => {
    const intento = await ctx.db.get(args.intentoId);
    if (!intento || intento.estado !== "reservado") return { ok: false };
    const cobro = await ctx.db.get(intento.cobroId);
    const negocio = await ctx.db.get(intento.negocioId);
    if (!cobro || !negocio || cobro.estado !== "borrador" || cobro.intentoActivoId !== intento._id || negocio.modo !== intento.modo) return { ok: false };
    if ((intento.tipo === "qr" && !args.qrString) || (intento.tipo === "link" && !args.urlPago)) {
      throw new ConvexError({ codigo: "TRANSICION_INVALIDA", mensaje: "El simulador devolvió un resultado incompleto." });
    }
    if (args.urlPago && !/^https:\/\/app\.mipey\.mx\/payment-link\/[A-Za-z0-9_-]+$/.test(args.urlPago)) {
      throw new ConvexError({ codigo: "TRANSICION_INVALIDA", mensaje: "El enlace de pago no está permitido." });
    }
    const ahora = Date.now();
    const siguienteIntento = transicionarIntento(intento.estado, "crear");
    const siguienteCobro = transicionarCobro(cobro.estado, "intento_creado");
    await ctx.db.patch(intento._id, {
      estado: siguienteIntento,
      peyPayableId: args.peyPayableId,
      ...(args.urlPago ? { urlPago: args.urlPago } : {}),
      ...(args.qrString ? { qrString: args.qrString } : {}),
    });
    await ctx.db.patch(cobro._id, { estado: siguienteCobro, actualizadoEn: ahora });
    await registrar(ctx, {
      negocioId: negocio._id, modo: negocio.modo, tipo: "intento.creado", cobroId: cobro._id, intentoId: intento._id,
      actor: { tipo: "pey" }, estadoAntes: "borrador", estadoDespues: siguienteCobro, detalle: {}, en: ahora,
    });
    return { ok: true };
  },
});

export const registrarFallido = internalMutation({
  args: { intentoId: v.id("intentos"), httpStatus: v.number() },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args) => {
    const intento = await ctx.db.get(args.intentoId);
    if (!intento || intento.estado !== "reservado") return { ok: false };
    const negocio = await ctx.db.get(intento.negocioId);
    if (!negocio || negocio.modo !== intento.modo) return { ok: false };
    await ctx.db.patch(intento._id, { estado: transicionarIntento(intento.estado, "fallar") });
    await registrar(ctx, {
      negocioId: negocio._id, modo: negocio.modo, tipo: "intento.fallido", cobroId: intento.cobroId,
      intentoId: intento._id, actor: { tipo: "pey" }, detalle: { httpStatus: args.httpStatus },
    });
    return { ok: true };
  },
});

export const registrarIncierto = internalMutation({
  args: { intentoId: v.id("intentos"), causa: v.union(v.literal("timeout"), v.literal("red"), v.literal("5xx")) },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args) => {
    const intento = await ctx.db.get(args.intentoId);
    if (!intento || intento.estado !== "reservado") return { ok: false };
    const negocio = await ctx.db.get(intento.negocioId);
    if (!negocio || negocio.modo !== intento.modo) return { ok: false };
    const ahora = Date.now();
    await ctx.db.patch(intento._id, { estado: transicionarIntento(intento.estado, "incierto"), inciertoEn: ahora });
    await registrar(ctx, {
      negocioId: negocio._id, modo: negocio.modo, tipo: "intento.incierto", cobroId: intento.cobroId,
      intentoId: intento._id, actor: { tipo: "pey" }, detalle: { causa: args.causa }, en: ahora,
    });
    await ctx.scheduler.runAfter(60_000, internal.motor.intentos.descartarIncierto, { intentoId: intento._id });
    return { ok: true };
  },
});

export const descartarIncierto = internalMutation({
  args: { intentoId: v.id("intentos") },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args) => {
    const intento = await ctx.db.get(args.intentoId);
    if (!intento || intento.estado !== "incierto" || intento.inciertoEn === undefined) return { ok: false };
    const ahora = Date.now();
    const faltanMs = intento.inciertoEn + 60_000 - ahora;
    if (faltanMs > 0) {
      await ctx.scheduler.runAfter(faltanMs, internal.motor.intentos.descartarIncierto, args);
      return { ok: false };
    }
    const negocio = await ctx.db.get(intento.negocioId);
    const cobro = await ctx.db.get(intento.cobroId);
    if (!negocio || !cobro || negocio.modo !== intento.modo) return { ok: false };
    await ctx.db.patch(intento._id, { estado: transicionarIntento(intento.estado, "descartar") });
    if (cobro.intentoActivoId === intento._id) await ctx.db.patch(cobro._id, { intentoActivoId: undefined });
    await registrar(ctx, {
      negocioId: negocio._id, modo: negocio.modo, tipo: "intento.descartado", cobroId: cobro._id,
      intentoId: intento._id, actor: { tipo: "sistema" }, detalle: { motivo: "incierto_60s" }, en: ahora,
    });
    return { ok: true };
  },
});

export const crearEnPey = internalAction({
  args: { intentoId: v.id("intentos") },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args) => {
    const modoConfigurado = await ctx.runQuery(internal.puertos.modoDeployment, {});
    const llamada = await ctx.runMutation(internal.motor.intentos.iniciarLlamada, { ...args, modoConfigurado });
    if (!llamada) return { ok: false };
    const puerto = crearPeyPuerto(ctx, llamada.negocioId, llamada.modo);
    let resultado: ResultadoCrear;
    try {
      if (llamada.tipo === "qr") {
        resultado = await puerto.crearQr({
          intentoPublicId: llamada.intentoPublicId, cobroPublicId: llamada.cobroPublicId,
          montoCentavos: llamada.montoCentavos, concepto: llamada.concepto, expiraSeg: 86400,
          numRef: String(llamada.folio % 10_000_000).padStart(1, "0"),
        });
      } else {
        const url = `https://example.invalid/pagar/${encodeURIComponent(llamada.cobroPublicId)}`;
        resultado = await puerto.crearLink({
          intentoPublicId: llamada.intentoPublicId, cobroPublicId: llamada.cobroPublicId,
          montoCentavos: llamada.montoCentavos, successUrl: url, backUrl: url,
        });
      }
    } catch {
      await ctx.runMutation(internal.motor.intentos.registrarIncierto, { intentoId: llamada.intentoId, causa: "red" });
      return { ok: true };
    }
    if (resultado.tipo === "creado") {
      await ctx.runMutation(internal.motor.intentos.registrarCreado, {
        intentoId: llamada.intentoId, peyPayableId: resultado.peyPayableId,
        ...(resultado.urlPago ? { urlPago: resultado.urlPago } : {}), ...(resultado.qrString ? { qrString: resultado.qrString } : {}),
      });
      return { ok: true };
    }
    if (resultado.tipo === "rechazado") {
      await ctx.runMutation(internal.motor.intentos.registrarFallido, { intentoId: llamada.intentoId, httpStatus: resultado.httpStatus });
      return { ok: true };
    }
    await ctx.runMutation(internal.motor.intentos.registrarIncierto, { intentoId: llamada.intentoId, causa: resultado.causa });
    return { ok: true };
  },
});

export function nuevoIntentoId(): string {
  return nuevoId("int_");
}
export type IdIntento = Id<"intentos">;
