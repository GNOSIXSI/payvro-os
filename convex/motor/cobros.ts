import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { transicionarCobro, transicionarIntento } from "@payvro/engine";
import type { EstadoCobro } from "@payvro/engine";
import { nuevoId } from "@payvro/engine/ids";
import type { Actor, Modo } from "./puertos";
import { consumirLimite } from "./limites";
import { registrar } from "./bitacora";
import { nuevoIntentoId } from "./intentos";

export interface EntradaCrearCobro {
  claveIdempotencia: string;
  concepto: string;
  montoCentavos: number;
  tipo?: "qr" | "link";
}

const CUENTA_FRESCA_MS = 24 * 60 * 60 * 1000;

function exigirCuentaLista(negocio: { estadoCuentaPey?: string; cuentaRevisadaEn?: number }, configPresente: boolean): void {
  const revisada = negocio.cuentaRevisadaEn;
  if (!configPresente || negocio.estadoCuentaPey !== "ACTIVE" || revisada === undefined || Date.now() - revisada > CUENTA_FRESCA_MS || revisada > Date.now()) {
    throw new ConvexError({ codigo: "CUENTA_NO_ACTIVA", mensaje: "La cuenta pey no está activa o falta configuración. Verifica la cuenta antes de crear cobros." });
  }
}

function validarClave(clave: string): void {
  if (clave.length < 16 || clave.length > 128 || !/^[A-Za-z0-9_-]+$/.test(clave)) {
    throw new ConvexError({ codigo: "CLAVE_REUTILIZADA", mensaje: "La clave de idempotencia no tiene un formato válido." });
  }
}

function validarEntrada(args: EntradaCrearCobro): "qr" | "link" {
  validarClave(args.claveIdempotencia);
  if (!Number.isSafeInteger(args.montoCentavos) || args.montoCentavos < 1 || args.montoCentavos > 100_000_000) {
    throw new ConvexError({ codigo: "MONTO_INVALIDO", mensaje: "El monto debe ser un entero positivo en centavos." });
  }
  if (typeof args.concepto !== "string" || args.concepto.trim().length < 1 || args.concepto.length > 140) {
    throw new ConvexError({ codigo: "MONTO_INVALIDO", mensaje: "El concepto debe tener entre 1 y 140 caracteres." });
  }
  return args.tipo ?? "qr";
}

export async function crearCobro(
  ctx: MutationCtx,
  entrada: EntradaCrearCobro,
  negocioId: Id<"negocios">,
  modo: Modo,
  actor: Actor,
  peyConfigPresente: boolean,
): Promise<{ publicId: string; folio: number; estado: EstadoCobro }> {
  const tipo = validarEntrada(entrada);
  const negocio = await ctx.db.get(negocioId);
  if (!negocio || negocio.modo !== modo) {
    throw new ConvexError({ codigo: "MODO_INVALIDO", mensaje: "El modo del negocio no coincide con la instalación." });
  }
  const existente = await ctx.db.query("cobros").withIndex("by_negocio_clave", (q) => q.eq("negocioId", negocioId).eq("claveIdempotencia", entrada.claveIdempotencia)).unique();
  if (existente) {
    let tipoExistente = existente.tipoInicial;
    if (!tipoExistente && existente.intentoActivoId) {
      const intentoOriginal = await ctx.db.get(existente.intentoActivoId);
      if (intentoOriginal?.cobroId === existente._id) tipoExistente = intentoOriginal.tipo;
    }
    if (existente.concepto !== entrada.concepto || existente.montoCentavos !== entrada.montoCentavos || tipoExistente !== tipo) {
      throw new ConvexError({ codigo: "CLAVE_REUTILIZADA", mensaje: "La clave ya se usó con otros datos." });
    }
    return { publicId: existente.publicId, folio: existente.folio, estado: existente.estado };
  }
  if (modo === "live") {
    if (tipo !== "qr") throw new ConvexError({ codigo: "TRANSICION_INVALIDA", mensaje: "En LIVE solo se admiten cobros CoDi QR." });
    exigirCuentaLista(negocio, peyConfigPresente);
  }
  if (negocio.cobrosPausados) {
    throw new ConvexError({ codigo: "COBROS_PAUSADOS", mensaje: "La creación de cobros está pausada." });
  }
  if (modo === "demo") await consumirLimite(ctx, `crear:${negocioId}`, 10);
  const ahora = Date.now();
  const folio = negocio.folioSiguiente;
  await ctx.db.patch(negocioId, { folioSiguiente: folio + 1 });
  const cobroId = await ctx.db.insert("cobros", {
    negocioId, modo, publicId: nuevoId("cob_"), folio, plantilla: "pedido", concepto: entrada.concepto,
    montoCentavos: entrada.montoCentavos, tipoInicial: tipo, moneda: "MXN", estado: "borrador",
    expiraEn: ahora + 24 * 60 * 60 * 1000, claveIdempotencia: entrada.claveIdempotencia,
    creadoPor: actor, creadoEn: ahora, actualizadoEn: ahora,
  });
  const intentoId = await ctx.db.insert("intentos", {
    negocioId, modo, publicId: nuevoIntentoId(), cobroId, tipo, estado: "reservado",
    montoCentavos: entrada.montoCentavos, destino: tipo === "qr" ? "bank_account_id" : "cuenta_de_la_llave",
    sondeoActivo: false, sondeos: 0, barridoActivo: true, siguienteBarridoEn: ahora + 45_000,
    claveIdempotencia: entrada.claveIdempotencia, creadoEn: ahora,
  });
  await ctx.db.patch(cobroId, { intentoActivoId: intentoId });
  await registrar(ctx, {
    negocioId, modo, tipo: "cobro.creado", cobroId, actor, estadoDespues: "borrador",
    detalle: { folio, montoCentavos: entrada.montoCentavos }, en: ahora,
  });
  await registrar(ctx, {
    negocioId, modo, tipo: "intento.reservado", cobroId, intentoId, actor,
    detalle: { tipo }, en: ahora,
  });
  await ctx.scheduler.runAfter(0, internal.motor.intentos.crearEnPey, { intentoId });
  return { publicId: (await ctx.db.get(cobroId))!.publicId, folio, estado: "borrador" };
}

export async function cancelarCobro(
  ctx: MutationCtx,
  negocioId: Id<"negocios">,
  modo: Modo,
  actor: Actor,
  publicId: string,
  claveIdempotencia: string,
): Promise<{ estado: EstadoCobro }> {
  validarClave(claveIdempotencia);
  const conClave = await ctx.db.query("cobros").withIndex("by_negocio_cancelClave", (q) => q.eq("negocioId", negocioId).eq("claveCancelacion", claveIdempotencia)).unique();
  if (conClave) {
    if (conClave.publicId !== publicId) throw new ConvexError({ codigo: "CLAVE_REUTILIZADA", mensaje: "La clave ya se usó con otro cobro." });
    return { estado: conClave.estado };
  }
  const cobro = await ctx.db.query("cobros").withIndex("by_publicId", (q) => q.eq("publicId", publicId)).unique();
  if (!cobro || cobro.negocioId !== negocioId || cobro.modo !== modo) {
    throw new ConvexError({ codigo: "NO_ENCONTRADO", mensaje: "No se encontró el cobro." });
  }
  if (cobro.estado === "cancelado") {
    await ctx.db.patch(cobro._id, { claveCancelacion: claveIdempotencia });
    return { estado: cobro.estado };
  }
  if (cobro.estado !== "borrador" && cobro.estado !== "esperando_pago") {
    throw new ConvexError({ codigo: "TRANSICION_INVALIDA", mensaje: "Este cobro no se puede cancelar." });
  }
  const ahora = Date.now();
  const siguiente = transicionarCobro(cobro.estado, "cancelar");
  await ctx.db.patch(cobro._id, { estado: siguiente, actualizadoEn: ahora, claveCancelacion: claveIdempotencia });
  if (cobro.intentoActivoId) {
    const intento = await ctx.db.get(cobro.intentoActivoId);
    if (intento?.estado === "creado") {
      await ctx.db.patch(intento._id, { estado: transicionarIntento(intento.estado, "descartar") });
      await registrar(ctx, {
        negocioId, modo, tipo: "intento.descartado", cobroId: cobro._id, intentoId: intento._id,
        actor: { tipo: "sistema" }, detalle: { motivo: "cobro_cancelado" }, en: ahora,
      });
    }
  }
  await registrar(ctx, {
    negocioId, modo, tipo: "cobro.cancelado", cobroId: cobro._id, actor,
    estadoAntes: cobro.estado, estadoDespues: siguiente, detalle: {}, en: ahora,
  });
  return { estado: siguiente };
}

export async function reintentarCobro(
  ctx: MutationCtx,
  negocioId: Id<"negocios">,
  modo: Modo,
  actor: Actor,
  publicId: string,
  claveIdempotencia: string,
  peyConfigPresente: boolean,
): Promise<{ publicId: string; estado: "reservado" | "creado" | "pagado" | "incierto" | "fallido" | "descartado" }> {
  validarClave(claveIdempotencia);
  const porClave = await ctx.db.query("intentos").withIndex("by_negocio_clave", (q) => q.eq("negocioId", negocioId).eq("claveIdempotencia", claveIdempotencia)).unique();
  const cobro = await ctx.db.query("cobros").withIndex("by_publicId", (q) => q.eq("publicId", publicId)).unique();
  if (!cobro || cobro.negocioId !== negocioId || cobro.modo !== modo) {
    throw new ConvexError({ codigo: "NO_ENCONTRADO", mensaje: "No se encontró el cobro." });
  }
  if (porClave) {
    if (porClave.cobroId !== cobro._id) throw new ConvexError({ codigo: "CLAVE_REUTILIZADA", mensaje: "La clave ya se usó con otros datos." });
    return { publicId: porClave.publicId, estado: porClave.estado };
  }
  if (cobro.estado !== "borrador") {
    throw new ConvexError({ codigo: "TRANSICION_INVALIDA", mensaje: "Este cobro no admite otro intento." });
  }
  const previo = cobro.intentoActivoId ? await ctx.db.get(cobro.intentoActivoId) : null;
  if (previo && previo.estado !== "fallido" && previo.estado !== "descartado") {
    throw new ConvexError({ codigo: "TRANSICION_INVALIDA", mensaje: "El intento actual todavía está activo." });
  }
  const negocio = await ctx.db.get(negocioId);
  if (!negocio || negocio.modo !== modo) throw new ConvexError({ codigo: "MODO_INVALIDO", mensaje: "El modo del negocio no coincide con la instalación." });
  if (modo === "live") {
    if ((previo?.tipo ?? "qr") !== "qr") throw new ConvexError({ codigo: "TRANSICION_INVALIDA", mensaje: "En LIVE solo se admiten cobros CoDi QR." });
    exigirCuentaLista(negocio, peyConfigPresente);
  }
  if (negocio.cobrosPausados) throw new ConvexError({ codigo: "COBROS_PAUSADOS", mensaje: "La creación de cobros está pausada." });
  if (modo === "demo") await consumirLimite(ctx, `crear:${negocioId}`, 10);
  const ahora = Date.now();
  const intentoId = await ctx.db.insert("intentos", {
    negocioId, modo, publicId: nuevoIntentoId(), cobroId: cobro._id,
    tipo: previo?.tipo ?? "qr", estado: "reservado", montoCentavos: cobro.montoCentavos,
    destino: (previo?.tipo ?? "qr") === "qr" ? "bank_account_id" : "cuenta_de_la_llave",
    sondeoActivo: false, sondeos: 0, barridoActivo: true, siguienteBarridoEn: ahora + 45_000,
    claveIdempotencia, creadoEn: ahora,
  });
  await ctx.db.patch(cobro._id, { intentoActivoId: intentoId });
  await registrar(ctx, {
    negocioId, modo, tipo: "intento.reservado", cobroId: cobro._id, intentoId, actor,
    detalle: { tipo: previo?.tipo ?? "qr" }, en: ahora,
  });
  await ctx.scheduler.runAfter(0, internal.motor.intentos.crearEnPey, { intentoId });
  const intento = await ctx.db.get(intentoId);
  return { publicId: intento!.publicId, estado: "reservado" };
}

export const expirarVencidos = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  returns: v.object({ expirados: v.number(), continuacion: v.boolean() }),
  handler: async (ctx, args) => {
    const ahora = Date.now();
    const page = await ctx.db.query("cobros")
      .withIndex("by_estado_expiraEn", (q) => q.eq("estado", "esperando_pago").lte("expiraEn", ahora))
      .paginate({ numItems: 100, cursor: args.cursor ?? null });
    let expirados = 0;
    for (const cobro of page.page) {
      if (cobro.estado !== "esperando_pago") continue;
      const negocio = await ctx.db.get(cobro.negocioId);
      if (!negocio || negocio.modo !== cobro.modo) continue;
      const nuevoEstado = transicionarCobro(cobro.estado, "expirar");
      await ctx.db.patch(cobro._id, { estado: nuevoEstado, actualizadoEn: ahora });
      if (cobro.intentoActivoId) {
        const intento = await ctx.db.get(cobro.intentoActivoId);
        if (intento?.estado === "creado") {
          await ctx.db.patch(intento._id, { estado: transicionarIntento(intento.estado, "descartar") });
          await registrar(ctx, {
            negocioId: negocio._id, modo: negocio.modo, tipo: "intento.descartado", cobroId: cobro._id,
            intentoId: intento._id, actor: { tipo: "sistema" }, detalle: { motivo: "cobro_expirado" }, en: ahora,
          });
        }
      }
      await registrar(ctx, {
        negocioId: negocio._id, modo: negocio.modo, tipo: "cobro.expirado", cobroId: cobro._id,
        actor: { tipo: "sistema" }, estadoAntes: "esperando_pago", estadoDespues: nuevoEstado, detalle: {}, en: ahora,
      });
      expirados += 1;
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.motor.cobros.expirarVencidos, { cursor: page.continueCursor });
    }
    return { expirados, continuacion: !page.isDone };
  },
});
