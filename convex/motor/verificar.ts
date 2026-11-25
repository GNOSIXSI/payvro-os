import { ConvexError, v } from "convex/values";
import type { RegisteredAction } from "convex/server";
import { internal } from "../_generated/api";
import { internalAction, internalMutation, internalQuery } from "../_generated/server";
import type { ActionCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { aCentavos, evaluar, PeyClientError, transicionarCobro, transicionarIntento } from "@payvro/engine";
import type { Evidencia, EvidenciaLink, TransaccionPey } from "@payvro/engine";
import { nuevoId } from "@payvro/engine/ids";
import { registrar } from "./bitacora";
import { crearPeyPuerto } from "./peyPuerto";
import { liberar } from "./liberar";
import { revisarEvidenciaPendiente } from "./cobros";

const estadoCobroValidator = v.union(
  v.literal("borrador"), v.literal("esperando_pago"), v.literal("pagado_verificado"),
  v.literal("liberado"), v.literal("expirado"), v.literal("cancelado"), v.literal("en_revision"),
);
const txValidator = v.object({
  transactionId: v.string(), status: v.union(v.literal("PENDING"), v.literal("PAID")), amount: v.number(),
  amountBreakdown: v.object({ base: v.number(), tip: v.number(), fee: v.number() }), currency: v.string(),
  paymentMethod: v.union(v.literal("CARD"), v.literal("CODI")),
  payableType: v.union(v.literal("PAYMENT_LINK"), v.literal("API_CODI_QR"), v.literal("API_CODI_PN")),
  payableId: v.string(), dateCreated: v.string(), datePaid: v.optional(v.string()), metadata: v.record(v.string(), v.string()),
});
const linkValidator = v.object({
  status: v.union(v.literal("pending"), v.literal("processing"), v.literal("paid"), v.literal("partial")),
  amount: v.number(), clientReferenceId: v.string(), metadata: v.record(v.string(), v.string()),
  transactions: v.array(v.object({ transactionId: v.string() })),
});
const origenValidator = v.union(v.literal("simulador"), v.literal("sondeo"), v.literal("barrido"), v.literal("webhook"));
type ResultadoPago = "coincide" | "monto_distinto" | "destino_distinto" | "metodo_no_permitido" | "con_propina" | "duplicado" | "pago_tardio" | "parcial";
const MAX_PAGINAS_QR = 10;
const MAX_PAGINAS_CUENTA = 10;
const SONDEO_INTERVALO_MS = 1_800;
const SONDEO_MAX_MS = 30_000;
const SONDEO_CADENA_MS = 15 * 60 * 1000;
const SONDEO_LEASE_MS = 60_000;
const BARRIDO_INTERVALO_MS = 45_000;
const BARRIDO_DESCARTADO_MS = 60_000;
// Provisional draft policy, not a production retry decision. Distinct completed checks only.
const UMBRAL_ILEGIBLES_CONSECUTIVOS = 3;

function mismoMonto(a: TransaccionPey, b: TransaccionPey): boolean {
  return a.amount === b.amount && a.amountBreakdown.base === b.amountBreakdown.base &&
    a.amountBreakdown.tip === b.amountBreakdown.tip && a.amountBreakdown.fee === b.amountBreakdown.fee;
}

function evidenciaSinRepeticiones(evidencia: Evidencia): Evidencia {
  const vistas = new Set<string>();
  const transacciones = evidencia.transacciones.filter((tx) => {
    const huella = JSON.stringify([
      tx.transactionId, tx.status, tx.amount, tx.amountBreakdown.base, tx.amountBreakdown.tip,
      tx.amountBreakdown.fee, tx.currency, tx.paymentMethod, tx.payableType, tx.payableId,
      tx.dateCreated, tx.datePaid, Object.entries(tx.metadata).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0),
    ]);
    if (vistas.has(huella)) return false;
    vistas.add(huella);
    return true;
  });
  return { ...evidencia, transacciones };
}

function mismaTransaccion(a: TransaccionPey, b: TransaccionPey): boolean {
  return a.transactionId === b.transactionId && a.status === "PAID" && b.status === "PAID" &&
    a.payableType === b.payableType && a.payableId === b.payableId && a.currency === b.currency &&
    a.paymentMethod === b.paymentMethod && mismoMonto(a, b) && a.datePaid === b.datePaid;
}

async function leaseSondeoDisponible(ctx: ActionCtx, intentoId: Id<"intentos">, leaseId?: string): Promise<boolean> {
  if (!leaseId) return true;
  return Boolean(await ctx.runMutation(internal.motor.verificar.prepararTickSondeo, { intentoId, leaseId }));
}

function codigoConvex(error: unknown): string | undefined {
  if (!(error instanceof ConvexError) || typeof error.data !== "object" || error.data === null || !("codigo" in error.data)) return undefined;
  return typeof error.data.codigo === "string" ? error.data.codigo : undefined;
}

function centavosDeComponente(pesos: number): number {
  return pesos === 0 ? 0 : aCentavos(pesos);
}

export const datosIntento = internalQuery({
  args: { intentoId: v.id("intentos") },
  returns: v.union(v.null(), v.object({
    intentoId: v.id("intentos"), negocioId: v.id("negocios"), modo: v.union(v.literal("demo"), v.literal("live")),
    publicId: v.string(), tipo: v.union(v.literal("link"), v.literal("qr")), estado: v.string(),
    peyPayableId: v.union(v.string(), v.null()), destino: v.union(v.literal("cuenta_de_la_llave"), v.literal("bank_account_id")),
    cobroId: v.id("cobros"), cobroPublicId: v.string(), montoCentavos: v.number(), estadoCobro: estadoCobroValidator,
    creadoEn: v.number(), expiraEn: v.number(), modoNegocio: v.union(v.literal("demo"), v.literal("live")),
  })),
  handler: async (ctx, args) => {
    const intento = await ctx.db.get(args.intentoId);
    if (!intento) return null;
    const cobro = await ctx.db.get(intento.cobroId);
    const negocio = await ctx.db.get(intento.negocioId);
    if (!cobro || !negocio || cobro.negocioId !== negocio._id || intento.negocioId !== negocio._id) return null;
    return {
      intentoId: intento._id, negocioId: negocio._id, modo: intento.modo, publicId: intento.publicId,
      tipo: intento.tipo, estado: intento.estado, peyPayableId: intento.peyPayableId ?? null,
      destino: intento.destino, cobroId: cobro._id, cobroPublicId: cobro.publicId,
      montoCentavos: cobro.montoCentavos, estadoCobro: cobro.estado, creadoEn: intento.creadoEn, expiraEn: cobro.expiraEn, modoNegocio: negocio.modo,
    };
  },
});

export const registrarLectura = internalMutation({
  args: { intentoId: v.id("intentos"), exitosa: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const intento = await ctx.db.get(args.intentoId);
    if (!intento) return null;
    const cobro = await ctx.db.get(intento.cobroId);
    const negocio = await ctx.db.get(intento.negocioId);
    if (!cobro || !negocio || cobro.negocioId !== negocio._id || intento.negocioId !== negocio._id || intento.modo !== negocio.modo) return null;
    const ahora = Date.now();
    const recuperable = intento.tipo === "qr" && (
      (intento.estado === "creado" && cobro.estado === "esperando_pago") ||
      (intento.estado === "descartado" && intento.peyPayableId !== undefined && cobro.creadoEn >= ahora - 24 * 60 * 60 * 1000)
    );
    const espera = intento.estado === "descartado" ? BARRIDO_DESCARTADO_MS : BARRIDO_INTERVALO_MS;
    await ctx.db.patch(intento._id, {
      sondeos: intento.sondeos + 1,
      ultimaVerificacionEn: ahora,
      barridoActivo: recuperable,
      siguienteBarridoEn: recuperable ? ahora + (args.exitosa ? espera : 60_000) : undefined,
    });
    return null;
  },
});

export const registrarDatoIlegible = internalMutation({
  args: {
    intentoId: v.id("intentos"), observacionId: v.string(),
    legible: v.boolean(), origen: origenValidator, registrarEvento: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const intento = await ctx.db.get(args.intentoId);
    const cobro = intento ? await ctx.db.get(intento.cobroId) : null;
    const negocio = intento ? await ctx.db.get(intento.negocioId) : null;
    if (!intento || !cobro || !negocio || intento.negocioId !== cobro.negocioId || cobro.negocioId !== negocio._id || intento.modo !== cobro.modo || cobro.modo !== negocio.modo) {
      throw new ConvexError({ codigo: "NO_ENCONTRADO", mensaje: "No se encontró el intento." });
    }
    const webhookId = `verificacion:${intento._id}:${args.observacionId}`;
    const recibo = await ctx.db.query("eventosPey").withIndex("by_negocio_webhookId", (q) => q.eq("negocioId", negocio._id).eq("webhookId", webhookId)).unique();
    if (recibo) return null;
    await ctx.db.insert("eventosPey", {
      negocioId: negocio._id, modo: negocio.modo, publicId: nuevoId("evt_"), origen: args.origen,
      webhookId, tipo: "verificacion.observada", hashCuerpo: "", recibidoEn: Date.now(), procesadoEn: Date.now(),
      resultado: args.legible ? "legible" : "ilegible",
    });
    if (args.legible) {
      if (intento.evidenciaPendiente || intento.ilegiblesConsecutivos) {
        await ctx.db.patch(intento._id, { evidenciaPendiente: false, ilegiblesConsecutivos: 0 });
      }
      return null;
    }
    const consecutivos = (intento.ilegiblesConsecutivos ?? 0) + 1;
    await ctx.db.patch(intento._id, { evidenciaPendiente: true, ilegiblesConsecutivos: consecutivos });
    if (consecutivos >= UMBRAL_ILEGIBLES_CONSECUTIVOS || cobro.estado === "expirado") {
      await revisarEvidenciaPendiente(ctx, cobro, negocio);
    }
    if (args.registrarEvento === false) return null;
    const ultima = await ctx.db.query("bitacora").withIndex("by_cobro_seq", (q) => q.eq("cobroId", cobro._id)).order("desc").first();
    if (ultima?.tipo === "pey.dato_ilegible") return null;
    await registrar(ctx, {
      negocioId: negocio._id, modo: negocio.modo, tipo: "pey.dato_ilegible", cobroId: cobro._id,
      intentoId: intento._id, actor: { tipo: "pey" }, detalle: {},
    });
    return null;
  },
});

export const aplicarEvidencia = internalMutation({
  args: {
    intentoId: v.id("intentos"), evidencia: v.object({
      transacciones: v.array(txValidator), link: v.optional(linkValidator), destinoConfirmado: v.optional(v.boolean()),
      motivoCuenta: v.optional(v.literal("monto_distinto")),
    }), origen: origenValidator,
  },
  returns: v.object({ ok: v.boolean(), resultado: v.string() }),
  handler: async (ctx, args) => {
    const intento = await ctx.db.get(args.intentoId);
    const cobro = intento ? await ctx.db.get(intento.cobroId) : null;
    const negocio = intento ? await ctx.db.get(intento.negocioId) : null;
    if (!intento || !cobro || !negocio || intento.negocioId !== cobro.negocioId || cobro.negocioId !== negocio._id || intento.modo !== cobro.modo || cobro.modo !== negocio.modo) {
      throw new ConvexError({ codigo: "NO_ENCONTRADO", mensaje: "No se encontró el intento." });
    }
    if (!intento.peyPayableId) return { ok: true, resultado: "sin_pago" };
    const evidencia = evidenciaSinRepeticiones(args.evidencia as Evidencia);
    const porId = new Map<string, TransaccionPey[]>();
    for (const tx of evidencia.transacciones) porId.set(tx.transactionId, [...(porId.get(tx.transactionId) ?? []), tx]);
    const conflicto = [...porId.values()].some((rows) => rows.length > 1 && rows.some((tx) =>
      tx.status === "PAID" && tx.payableId === intento.peyPayableId &&
      tx.payableType === (intento.tipo === "qr" ? "API_CODI_QR" : "PAYMENT_LINK")));
    if (conflicto) {
      if (cobro.conflictoEvidencia) return { ok: true, resultado: "repetido" };
      // Neither version is payment truth. Persist the conflict, never an arbitrary amount.
      await ctx.db.patch(cobro._id, { conflictoEvidencia: true, alerta: "pago_duplicado" });
      await revisarEvidenciaPendiente(ctx, cobro, negocio, "duplicado");
      await registrar(ctx, {
        negocioId: negocio._id, modo: negocio.modo, tipo: "pago.duplicado", cobroId: cobro._id,
        intentoId: intento._id, actor: { tipo: "pey" }, detalle: { motivo: "duplicado" },
      });
      return { ok: true, resultado: "duplicado" };
    }
    const evaluado = evaluar({
      tipo: intento.tipo, peyPayableId: intento.peyPayableId, intentoPublicId: intento.publicId,
      montoCentavos: intento.montoCentavos, destino: intento.destino,
    }, evidencia);
    if (evaluado.resultado === "sin_pago") return { ok: true, resultado: "sin_pago" };
    const veredicto = args.evidencia.motivoCuenta && (evaluado.resultado === "coincide" || evaluado.motivo === "destino_distinto")
      ? { resultado: "revisar" as const, motivo: args.evidencia.motivoCuenta, transacciones: evaluado.transacciones }
      : evaluado;
    const pagadas = [...new Map(veredicto.transacciones.map((tx) => [tx.transactionId, tx])).values()];
    const nuevas: TransaccionPey[] = [];
    for (const transaccion of pagadas) {
      const reclamo = await ctx.db.query("pagos").withIndex("by_peyTransactionId", (q) => q.eq("peyTransactionId", transaccion.transactionId)).unique();
      if (reclamo && reclamo.cobroId !== cobro._id) {
        throw new ConvexError({ codigo: "CLAVE_REUTILIZADA", mensaje: "La transacción ya está ligada a otro cobro." });
      }
      if (!reclamo) nuevas.push(transaccion);
    }
    if (nuevas.length === 0) return { ok: true, resultado: "repetido" };
    const ahora = Date.now();
    const evidenciaIlegibleSinPago = cobro.estado === "en_revision" && cobro.pagoId === undefined && cobro.motivoRevision === "evidencia_ilegible";
    const tardio = cobro.estado === "expirado" || cobro.estado === "cancelado" ||
      (evidenciaIlegibleSinPago && (cobro.expiraEn <= ahora || cobro.claveCancelacion !== undefined));
    const liberado = cobro.estado === "liberado" || cobro.estado === "pagado_verificado" || cobro.liberadoEn !== undefined;
    let resultadoPago: ResultadoPago = veredicto.resultado === "coincide" ? "coincide" : veredicto.motivo;
    if (tardio) resultadoPago = "pago_tardio";
    if (liberado || (cobro.estado === "en_revision" && veredicto.resultado === "coincide" && !evidenciaIlegibleSinPago)) resultadoPago = "duplicado";
    if (resultadoPago === "duplicado") await ctx.db.patch(cobro._id, { alerta: "pago_duplicado", actualizadoEn: ahora });
    const pagosInsertados: Id<"pagos">[] = [];
    let nuevasBaseCentavos = 0;
    for (const transaccion of nuevas) {
      let baseCentavos: number;
      let feeCentavos: number;
      let tipCentavos: number;
      let totalCentavos: number;
      let pagadoEn: number;
      try {
        baseCentavos = aCentavos(transaccion.amountBreakdown.base);
        feeCentavos = centavosDeComponente(transaccion.amountBreakdown.fee);
        tipCentavos = centavosDeComponente(transaccion.amountBreakdown.tip);
        totalCentavos = aCentavos(transaccion.amount);
        pagadoEn = transaccion.datePaid ? Date.parse(transaccion.datePaid) : Number.NaN;
      } catch {
        throw new ConvexError({ codigo: "MONTO_INVALIDO", mensaje: "La evidencia tiene un monto inválido." });
      }
      if (!Number.isFinite(pagadoEn)) throw new ConvexError({ codigo: "TRANSICION_INVALIDA", mensaje: "La evidencia no incluye una fecha de pago válida." });
      nuevasBaseCentavos += baseCentavos;
      const pagoId = await ctx.db.insert("pagos", {
        negocioId: negocio._id, modo: negocio.modo, publicId: nuevoId("pag_"), cobroId: cobro._id,
        intentoId: intento._id, peyTransactionId: transaccion.transactionId, payableType: transaccion.payableType,
        payableId: transaccion.payableId, metodo: transaccion.paymentMethod, baseCentavos, feeCentavos,
        tipCentavos, totalCentavos, pagadoEn, ...(transaccion.metadata.trackingKey ? { claveRastreo: transaccion.metadata.trackingKey } : {}),
        resultado: resultadoPago, verificadoEn: ahora,
      });
      pagosInsertados.push(pagoId);
    }
    if (liberado) {
      await ctx.db.patch(cobro._id, { alerta: "pago_duplicado", actualizadoEn: ahora });
      for (const pagoId of pagosInsertados) {
        await registrar(ctx, {
          negocioId: negocio._id, modo: negocio.modo, tipo: "pago.duplicado", cobroId: cobro._id,
          intentoId: intento._id, pagoId, actor: { tipo: "pey" }, detalle: { motivo: "duplicado" }, en: ahora,
        });
      }
      return { ok: true, resultado: "duplicado" };
    }
    if (cobro.estado === "en_revision") {
      if (evidenciaIlegibleSinPago) {
        await ctx.db.patch(cobro._id, {
          pagoId: pagosInsertados[0], verificadoEn: ahora, actualizadoEn: ahora,
          ...(tardio ? { motivoRevision: "pago_tardio" } : {}),
        });
      }
      for (const pagoId of pagosInsertados) {
        const tipo = resultadoPago === "duplicado" ? "pago.duplicado" : resultadoPago === "coincide" ? "pago.verificado" : "pago.no_coincide";
        await registrar(ctx, {
          negocioId: negocio._id, modo: negocio.modo, tipo, cobroId: cobro._id,
          intentoId: intento._id, pagoId, actor: { tipo: "pey" },
          detalle: resultadoPago === "coincide" ? {} : { motivo: resultadoPago }, en: ahora,
        });
      }
      return { ok: true, resultado: resultadoPago };
    }
    if (tardio) {
      const nuevoEstado = transicionarCobro(cobro.estado, "pago_tardio");
      const pagoId = pagosInsertados[0];
      await ctx.db.patch(cobro._id, { estado: nuevoEstado, motivoRevision: "pago_tardio", pagoId, verificadoEn: ahora, actualizadoEn: ahora });
      await ctx.db.patch(negocio._id, { enRevisionCount: (negocio.enRevisionCount ?? 0) + 1 });
      await registrar(ctx, {
        negocioId: negocio._id, modo: negocio.modo, tipo: "pago.no_coincide", cobroId: cobro._id,
        intentoId: intento._id, pagoId, actor: { tipo: "pey" }, detalle: { motivo: "pago_tardio" }, en: ahora,
      });
      await registrar(ctx, {
        negocioId: negocio._id, modo: negocio.modo, tipo: "cobro.en_revision", cobroId: cobro._id,
        intentoId: intento._id, pagoId, actor: { tipo: "sistema" }, estadoAntes: cobro.estado,
        estadoDespues: nuevoEstado, detalle: { motivo: "pago_tardio" }, en: ahora,
      });
      return { ok: true, resultado: "pago_tardio" };
    }
    if (cobro.estado === "esperando_pago" && veredicto.resultado === "coincide") {
      const pagoId = pagosInsertados[0];
      const nuevoEstado = transicionarCobro(cobro.estado, "coincide");
      await ctx.db.patch(cobro._id, { estado: nuevoEstado, pagoId, verificadoEn: ahora, actualizadoEn: ahora });
      const inicioDia = Date.UTC(new Date(ahora).getUTCFullYear(), new Date(ahora).getUTCMonth(), new Date(ahora).getUTCDate());
      const verificadoHoyCentavos = (negocio.verificadoHoyDia === inicioDia ? negocio.verificadoHoyCentavos ?? 0 : 0) + nuevasBaseCentavos;
      await ctx.db.patch(negocio._id, { verificadoHoyDia: inicioDia, verificadoHoyCentavos });
      if (intento.estado === "creado") await ctx.db.patch(intento._id, { estado: transicionarIntento(intento.estado, "pagar") });
      await registrar(ctx, {
        negocioId: negocio._id, modo: negocio.modo, tipo: "pago.verificado", cobroId: cobro._id,
        intentoId: intento._id, pagoId, actor: { tipo: "pey" }, estadoAntes: cobro.estado,
        estadoDespues: nuevoEstado, detalle: {}, en: ahora,
      });
      await liberar(ctx, { ...cobro, estado: nuevoEstado, pagoId, verificadoEn: ahora, actualizadoEn: ahora }, negocio, { tipo: "sistema" }, ahora);
      return { ok: true, resultado: "coincide" };
    }
    if (cobro.estado === "esperando_pago") {
      const motivo = veredicto.resultado === "revisar" ? veredicto.motivo : "duplicado";
      const nuevoEstado = transicionarCobro(cobro.estado, "revisar");
      const pagoId = pagosInsertados[0];
      await ctx.db.patch(cobro._id, { estado: nuevoEstado, motivoRevision: motivo, pagoId, verificadoEn: ahora, actualizadoEn: ahora });
      await ctx.db.patch(negocio._id, { enRevisionCount: (negocio.enRevisionCount ?? 0) + 1 });
      await registrar(ctx, {
        negocioId: negocio._id, modo: negocio.modo, tipo: motivo === "duplicado" ? "pago.duplicado" : "pago.no_coincide", cobroId: cobro._id,
        intentoId: intento._id, pagoId, actor: { tipo: "pey" }, detalle: { motivo }, en: ahora,
      });
      await registrar(ctx, {
        negocioId: negocio._id, modo: negocio.modo, tipo: "cobro.en_revision", cobroId: cobro._id,
        intentoId: intento._id, pagoId, actor: { tipo: "sistema" }, estadoAntes: cobro.estado,
        estadoDespues: nuevoEstado, detalle: { motivo }, en: ahora,
      });
      return { ok: true, resultado: motivo };
    }
    throw new ConvexError({ codigo: "TRANSICION_INVALIDA", mensaje: "El cobro no admite aplicar esta evidencia." });
  },
});

export const verificarIntento = internalAction({
  args: { intentoId: v.id("intentos"), origen: origenValidator, leaseId: v.optional(v.string()), observacionId: v.optional(v.string()) },
  returns: v.object({ ok: v.boolean(), resultado: v.string() }),
  handler: async (ctx, args): Promise<{ ok: boolean; resultado: string }> => {
    const modoConfigurado = await ctx.runQuery(internal.puertos.modoDeployment, {});
    const datos = await ctx.runQuery(internal.motor.verificar.datosIntento, { intentoId: args.intentoId });
    if (!datos || !datos.peyPayableId || datos.modo !== datos.modoNegocio) return { ok: false, resultado: "sin_pago" };
    if (datos.modo !== modoConfigurado) throw new ConvexError({ codigo: "MODO_INVALIDO", mensaje: "El modo del intento no coincide con la instalación." });
    if (datos.estado !== "creado" && datos.estado !== "descartado" && datos.estado !== "pagado") return { ok: false, resultado: "sin_pago" };
    if (datos.modo === "live" && datos.tipo !== "qr") return { ok: false, resultado: "capacidad_no_disponible" };

    // A lease identifies a scheduled check across delivery retries; other callers may supply a durable receipt id.
    const observacionId = args.observacionId ?? args.leaseId ?? nuevoId("evt_");
    try {
      const puerto = crearPeyPuerto(ctx, datos.negocioId, datos.modo);
      let link: EvidenciaLink | undefined;
      const transacciones: TransaccionPey[] = [];
      if (datos.tipo === "link") {
        if (!(await leaseSondeoDisponible(ctx, args.intentoId, args.leaseId))) return { ok: false, resultado: "sondeo_deteniendo" };
        link = await puerto.leerLink(datos.peyPayableId);
        for (const referencia of link.transactions) {
          if (!(await leaseSondeoDisponible(ctx, args.intentoId, args.leaseId))) return { ok: false, resultado: "sondeo_deteniendo" };
          transacciones.push(await puerto.leerTransaccion(referencia.transactionId));
        }
      } else {
        const referencias = new Set<string>();
        let token: string | undefined;
        let completa = false;
        for (let paginaNumero = 0; paginaNumero < MAX_PAGINAS_QR; paginaNumero += 1) {
          if (!(await leaseSondeoDisponible(ctx, args.intentoId, args.leaseId))) return { ok: false, resultado: "sondeo_deteniendo" };
          const pagina = await puerto.listarTransaccionesQr(datos.peyPayableId, token);
          for (const referencia of pagina.transactions) referencias.add(referencia.transactionId);
          token = pagina.nextToken ?? undefined;
          if (!token) {
            completa = true;
            break;
          }
        }
        if (!completa) {
          await ctx.runMutation(internal.motor.verificar.registrarLectura, { intentoId: args.intentoId, exitosa: false });
          return { ok: false, resultado: "evidencia_incompleta" };
        }
        for (const transactionId of referencias) {
          if (!(await leaseSondeoDisponible(ctx, args.intentoId, args.leaseId))) return { ok: false, resultado: "sondeo_deteniendo" };
          transacciones.push(await puerto.leerTransaccion(transactionId));
        }
      }

      let destinoConfirmado = false;
      let motivoCuenta: "monto_distinto" | undefined;
      if (datos.tipo === "qr" && datos.destino === "bank_account_id") {
        const relevantes = transacciones.filter((tx) => tx.status === "PAID" && tx.currency === "MXN" && tx.payableType === "API_CODI_QR" && tx.payableId === datos.peyPayableId);
        if (relevantes.length > 0) {
          const encontrados = new Set<string>();
          let token: string | undefined;
          let listaCompleta = false;
          let pruebaInconclusa = false;
          let datoIlegible = false;
          for (let paginaNumero = 0; paginaNumero < MAX_PAGINAS_CUENTA; paginaNumero += 1) {
            if (!(await leaseSondeoDisponible(ctx, args.intentoId, args.leaseId))) return { ok: false, resultado: "sondeo_deteniendo" };
            const pagina = await puerto.listarTransaccionesCuenta(token);
            if (pagina.idsDescartadas.some((id, index) => {
              if (id !== null) return relevantes.some((tx) => tx.transactionId === id);
              const dato = pagina.datosDescartadas?.[index];
              const montoCompatible = dato?.baseCentavos == null || dato.baseCentavos === datos.montoCentavos;
              const fechaCompatible = dato?.pagadoEn == null || (dato.pagadoEn >= datos.creadoEn && dato.pagadoEn <= datos.expiraEn);
              return montoCompatible && fechaCompatible;
            })) {
              pruebaInconclusa = true;
              datoIlegible = true;
            }
            for (const row of pagina.transactions) {
              const objetivo = relevantes.find((tx) => tx.transactionId === row.transactionId);
              if (objetivo && mismaTransaccion(objetivo, row)) encontrados.add(row.transactionId);
              else if (objetivo) {
                if (row.status === "PAID" && !mismoMonto(objetivo, row)) motivoCuenta = "monto_distinto";
                else pruebaInconclusa = true;
              }
            }
            if (!motivoCuenta && !pruebaInconclusa && relevantes.every((tx) => encontrados.has(tx.transactionId))) {
              listaCompleta = true;
              destinoConfirmado = true;
              break;
            }
            token = pagina.nextToken ?? undefined;
            if (!token) {
              listaCompleta = true;
              break;
            }
          }
          if (!destinoConfirmado && pruebaInconclusa) {
            await ctx.runMutation(internal.motor.verificar.registrarDatoIlegible, {
              intentoId: args.intentoId, observacionId, legible: false, origen: args.origen, registrarEvento: datoIlegible,
            });
            await ctx.runMutation(internal.motor.verificar.registrarLectura, { intentoId: args.intentoId, exitosa: false });
            return { ok: false, resultado: "diferida" };
          }
          if (!listaCompleta) {
            await ctx.runMutation(internal.motor.verificar.registrarLectura, { intentoId: args.intentoId, exitosa: false });
            return { ok: false, resultado: "evidencia_incompleta" };
          }
        }
      }
      const evidencia = {
        transacciones,
        ...(link ? { link } : {}),
        ...(datos.tipo === "qr" ? { destinoConfirmado } : {}),
        ...(motivoCuenta ? { motivoCuenta } : {}),
      };
      const resultado = await ctx.runMutation(internal.motor.verificar.aplicarEvidencia, { intentoId: args.intentoId, evidencia, origen: args.origen });
      await ctx.runMutation(internal.motor.verificar.registrarDatoIlegible, { intentoId: args.intentoId, observacionId, legible: true, origen: args.origen });
      await ctx.runMutation(internal.motor.verificar.registrarLectura, { intentoId: args.intentoId, exitosa: true });
      return resultado;
    } catch (error) {
      await ctx.runMutation(internal.motor.verificar.registrarLectura, { intentoId: args.intentoId, exitosa: false });
      if (error instanceof PeyClientError || (error instanceof ConvexError && codigoConvex(error) === "CUENTA_NO_ACTIVA")) {
        return { ok: false, resultado: "diferida" };
      }
      throw error;
    }
  },
});

export const prepararTickSondeo = internalMutation({
  args: { intentoId: v.id("intentos"), leaseId: v.string() },
  returns: v.union(v.null(), v.object({ listo: v.boolean() })),
  handler: async (ctx, args) => {
    const intento = await ctx.db.get(args.intentoId);
    const ahora = Date.now();
    if (!intento || !intento.sondeoActivo || intento.sondeoLeaseId !== args.leaseId || (intento.sondeoLeaseHasta ?? 0) <= ahora) return null;
    const cobro = await ctx.db.get(intento.cobroId);
    const negocio = await ctx.db.get(intento.negocioId);
    const inicio = intento.sondeoInicioEn;
    const activo = cobro?.estado === "esperando_pago" && intento.estado === "creado" && negocio?.modo === "live" &&
      intento.modo === "live" && cobro.negocioId === negocio._id && intento.negocioId === negocio._id &&
      intento.vigiladoHasta !== undefined && intento.vigiladoHasta > ahora && inicio !== undefined && ahora - inicio < SONDEO_CADENA_MS;
    if (!activo) {
      await ctx.db.patch(intento._id, { sondeoActivo: false, sondeoLeaseHasta: undefined, sondeoLeaseId: undefined });
      return null;
    }
    await ctx.db.patch(intento._id, { sondeoLeaseHasta: ahora + SONDEO_LEASE_MS });
    return { listo: true };
  },
});

export const terminarTickSondeo = internalMutation({
  args: { intentoId: v.id("intentos"), leaseId: v.string(), exitoso: v.boolean() },
  returns: v.object({ programado: v.boolean() }),
  handler: async (ctx, args) => {
    const intento = await ctx.db.get(args.intentoId);
    const ahora = Date.now();
    if (!intento || intento.sondeoLeaseId !== args.leaseId || !intento.sondeoActivo) return { programado: false };
    const cobro = await ctx.db.get(intento.cobroId);
    const negocio = await ctx.db.get(intento.negocioId);
    const inicio = intento.sondeoInicioEn;
    const debeSeguir = cobro?.estado === "esperando_pago" && intento.estado === "creado" && negocio?.modo === "live" &&
      intento.modo === "live" && intento.vigiladoHasta !== undefined && intento.vigiladoHasta > ahora &&
      inicio !== undefined && ahora - inicio < SONDEO_CADENA_MS;
    if (!debeSeguir) {
      await ctx.db.patch(intento._id, { sondeoActivo: false, sondeoLeaseHasta: undefined, sondeoLeaseId: undefined });
      return { programado: false };
    }
    const previo = intento.sondeoBackoffMs ?? 2_000;
    const intervalo = args.exitoso
      ? SONDEO_INTERVALO_MS
      : Math.min(SONDEO_MAX_MS, previo < 2_000 ? 2_000 : previo * 2);
    const leaseId = nuevoId("evt_");
    await ctx.db.patch(intento._id, {
      sondeoLeaseId: leaseId,
      sondeoLeaseHasta: ahora + SONDEO_LEASE_MS,
      sondeoBackoffMs: intervalo,
    });
    await ctx.scheduler.runAfter(intervalo, internal.motor.verificar.tickSondeo, { intentoId: intento._id, leaseId });
    return { programado: true };
  },
});

export const tickSondeo: RegisteredAction<"internal", { intentoId: Id<"intentos">; leaseId: string }, { ok: boolean }> = internalAction({
  args: { intentoId: v.id("intentos"), leaseId: v.string() },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args) => {
    const preparado = await ctx.runMutation(internal.motor.verificar.prepararTickSondeo, args);
    if (!preparado) return { ok: false };
    let exitoso = false;
    try {
      const resultado = await ctx.runAction(internal.motor.verificar.verificarIntento, { intentoId: args.intentoId, origen: "sondeo", leaseId: args.leaseId });
      exitoso = resultado.ok;
    } catch {
      exitoso = false;
    }
    const finalizado = await ctx.runMutation(internal.motor.verificar.terminarTickSondeo, { ...args, exitoso });
    return { ok: finalizado.programado };
  },
});
