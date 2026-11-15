import { ConvexError, v } from "convex/values";
import type { ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { internalAction, internalMutation, internalQuery } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { crearClientePey, crearSimulador } from "@payvro/engine";
import type { PeyPuerto, SimStore, TransaccionPey, VariantePago } from "@payvro/engine";
import { puertosMotor } from "../puertos";
import type { Modo } from "./puertos";
import { nuevoId } from "@payvro/engine/ids";

const txValidator = v.object({
  transactionId: v.string(), status: v.union(v.literal("PENDING"), v.literal("PAID")), amount: v.number(),
  amountBreakdown: v.object({ base: v.number(), tip: v.number(), fee: v.number() }), currency: v.string(),
  paymentMethod: v.union(v.literal("CARD"), v.literal("CODI")),
  payableType: v.union(v.literal("PAYMENT_LINK"), v.literal("API_CODI_QR"), v.literal("API_CODI_PN")),
  payableId: v.string(), dateCreated: v.string(), datePaid: v.optional(v.string()), metadata: v.record(v.string(), v.string()),
});
const payableValidator = v.object({
  id: v.string(), montoCentavos: v.number(), intentoPublicId: v.string(), tipo: v.union(v.literal("link"), v.literal("qr")),
  url: v.string(), qrString: v.optional(v.string()),
});

export const leerPayable = internalQuery({
  args: { negocioId: v.id("negocios"), id: v.string() },
  returns: v.union(v.null(), payableValidator),
  handler: async (ctx, args) => {
    const row = await ctx.db.query("simPayables").withIndex("por_idSim", (q) => q.eq("id", args.id)).unique();
    if (!row || row.negocioId !== args.negocioId || row.modo !== "demo") return null;
    return { id: row.id, montoCentavos: row.montoCentavos, intentoPublicId: row.intentoPublicId, tipo: row.tipo, url: row.url, ...(row.qrString ? { qrString: row.qrString } : {}) };
  },
});

export const listarTransacciones = internalQuery({
  args: { negocioId: v.id("negocios"), payableId: v.optional(v.string()), nextToken: v.optional(v.string()) },
  returns: v.object({ transactions: v.array(txValidator), nextToken: v.union(v.string(), v.null()) }),
  handler: async (ctx, args) => {
    const query = args.payableId
      ? ctx.db.query("simTransacciones").withIndex("by_payable_business_mode", (q) => q.eq("payableId", args.payableId!).eq("negocioId", args.negocioId).eq("modo", "demo"))
      : ctx.db.query("simTransacciones").withIndex("by_negocio_mode", (q) => q.eq("negocioId", args.negocioId).eq("modo", "demo"));
    const page = await query.paginate({ numItems: 100, cursor: args.nextToken ?? null });
    return {
      transactions: page.page.map((row) => ({
        transactionId: row.transactionId, status: row.status, amount: row.amount, amountBreakdown: row.amountBreakdown,
        currency: row.currency, paymentMethod: row.paymentMethod,
        payableType: row.payableType as "PAYMENT_LINK" | "API_CODI_QR" | "API_CODI_PN", payableId: row.payableId,
        dateCreated: row.dateCreated, ...(row.datePaid ? { datePaid: row.datePaid } : {}), metadata: row.metadata,
      })),
      nextToken: page.isDone ? null : page.continueCursor,
    };
  },
});

export const listarPayables = internalQuery({
  args: { negocioId: v.id("negocios"), nextToken: v.optional(v.string()) },
  returns: v.object({ ids: v.array(v.string()), nextToken: v.union(v.string(), v.null()) }),
  handler: async (ctx, args) => {
    const page = await ctx.db.query("simPayables")
      .withIndex("by_negocio_mode", (q) => q.eq("negocioId", args.negocioId).eq("modo", "demo"))
      .paginate({ numItems: 100, cursor: args.nextToken ?? null });
    return { ids: page.page.map((row) => row.id), nextToken: page.isDone ? null : page.continueCursor };
  },
});

export const leerTransaccion = internalQuery({
  args: { negocioId: v.id("negocios"), transactionId: v.string() },
  returns: v.union(v.null(), txValidator),
  handler: async (ctx, args) => {
    const row = await ctx.db.query("simTransacciones").withIndex("by_transaction", (q) => q.eq("transactionId", args.transactionId)).unique();
    if (!row || row.negocioId !== args.negocioId || row.modo !== "demo") return null;
    return {
      transactionId: row.transactionId, status: row.status, amount: row.amount, amountBreakdown: row.amountBreakdown,
      currency: row.currency, paymentMethod: row.paymentMethod,
      payableType: row.payableType as "PAYMENT_LINK" | "API_CODI_QR" | "API_CODI_PN", payableId: row.payableId,
      dateCreated: row.dateCreated, ...(row.datePaid ? { datePaid: row.datePaid } : {}), metadata: row.metadata,
    };
  },
});

export const guardarPayable = internalMutation({
  args: {
    negocioId: v.id("negocios"), id: v.string(), montoCentavos: v.number(), intentoPublicId: v.string(),
    tipo: v.union(v.literal("link"), v.literal("qr")), url: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const negocio = await ctx.db.get(args.negocioId);
    if (!negocio || negocio.modo !== "demo" || !Number.isSafeInteger(args.montoCentavos) || args.montoCentavos < 1) {
      throw new ConvexError({ codigo: "MODO_INVALIDO", mensaje: "El simulador solo funciona con montos positivos en DEMO." });
    }
    const anterior = await ctx.db.query("simPayables").withIndex("por_idSim", (q) => q.eq("id", args.id)).unique();
    if (anterior) {
      if (anterior.negocioId !== negocio._id || anterior.intentoPublicId !== args.intentoPublicId) {
        throw new ConvexError({ codigo: "NO_AUTORIZADO", mensaje: "El payable simulado no pertenece a este negocio." });
      }
      return null;
    }
    const qrString = `PAYVRO-DEMO:${args.id}`;
    await ctx.db.insert("simPayables", {
      negocioId: negocio._id, modo: "demo", id: args.id, montoCentavos: args.montoCentavos,
      intentoPublicId: args.intentoPublicId, tipo: args.tipo, url: args.url,
      ...(args.tipo === "qr" ? { qrString } : {}),
    });
    return null;
  },
});

export const guardarTransacciones = internalMutation({
  args: { negocioId: v.id("negocios"), payableId: v.string(), transactions: v.array(txValidator) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const negocio = await ctx.db.get(args.negocioId);
    const payable = await ctx.db.query("simPayables").withIndex("por_idSim", (q) => q.eq("id", args.payableId)).unique();
    if (!negocio || negocio.modo !== "demo" || !payable || payable.negocioId !== negocio._id || payable.modo !== "demo") {
      throw new ConvexError({ codigo: "SOLO_DEMO", mensaje: "La simulación solo está disponible en DEMO." });
    }
    const variantesGuardadas = new Set(payable.simulacionVariantes ?? []);
    const variantesEntrantes = new Set<VariantePago>();
    for (const transaction of args.transactions) {
      const variante = transaction.metadata.payvro_simulacion;
      if (variante !== "exacto" && variante !== "monto_distinto" && variante !== "duplicado" && variante !== "tarjeta") {
        throw new ConvexError({ codigo: "TRANSICION_INVALIDA", mensaje: "La variante simulada no está permitida." });
      }
      if (!variantesGuardadas.has(variante)) variantesEntrantes.add(variante);
    }
    if (variantesEntrantes.size === 0) return null;
    for (const transaction of args.transactions) {
      if (!variantesEntrantes.has(transaction.metadata.payvro_simulacion as VariantePago)) continue;
      if (transaction.payableId !== payable.id) {
        throw new ConvexError({ codigo: "TRANSICION_INVALIDA", mensaje: "La transacción no pertenece al payable simulado." });
      }
      const existente = await ctx.db.query("simTransacciones").withIndex("by_transaction", (q) => q.eq("transactionId", transaction.transactionId)).unique();
      if (existente) {
        if (existente.negocioId !== negocio._id || existente.payableId !== payable.id) {
          throw new ConvexError({ codigo: "CLAVE_REUTILIZADA", mensaje: "La transacción simulada ya tiene otro dueño." });
        }
        continue;
      }
      await ctx.db.insert("simTransacciones", { ...transaction, negocioId: negocio._id, modo: "demo" });
    }
    await ctx.db.patch(payable._id, { simulacionVariantes: [...variantesGuardadas, ...variantesEntrantes] });
    return null;
  },
});

function crearStore(ctx: ActionCtx, negocioId: Id<"negocios">): SimStore {
  async function todasLasTransacciones(payableId: string): Promise<TransaccionPey[]> {
    const transactions: TransaccionPey[] = [];
    let nextToken: string | undefined;
    do {
      const page = await ctx.runQuery(internal.motor.peyPuerto.listarTransacciones, { negocioId, payableId, nextToken });
      transactions.push(...page.transactions as TransaccionPey[]);
      nextToken = page.nextToken ?? undefined;
    } while (nextToken);
    return transactions;
  }
  return {
    getPayable: async (id) => {
      const row = await ctx.runQuery(internal.motor.peyPuerto.leerPayable, { negocioId, id });
      return row ? { id: row.id, montoCentavos: row.montoCentavos, intentoPublicId: row.intentoPublicId, tipo: row.tipo } : null;
    },
    savePayable: async (row) => { await ctx.runMutation(internal.motor.peyPuerto.guardarPayable, { negocioId, ...row }); },
    getTransactions: todasLasTransacciones,
    saveTransactions: async (payableId, rows) => { await ctx.runMutation(internal.motor.peyPuerto.guardarTransacciones, { negocioId, payableId, transactions: rows }); },
    nextId: () => `sim_${nuevoId("evt_")}`,
    listPayableIds: async () => {
      const ids: string[] = [];
      let nextToken: string | undefined;
      do {
        const page = await ctx.runQuery(internal.motor.peyPuerto.listarPayables, { negocioId, nextToken });
        ids.push(...page.ids);
        nextToken = page.nextToken ?? undefined;
      } while (nextToken);
      return ids;
    },
  };
}

export function crearPeyPuerto(ctx: ActionCtx, negocioId: Id<"negocios">, modo: Modo): PeyPuerto {
  if (modo === "demo") return crearSimulador(crearStore(ctx, negocioId));
  let clienteLive: Promise<PeyPuerto> | undefined;
  const live = (): Promise<PeyPuerto> => {
    clienteLive ??= puertosMotor.credencialPey(ctx, negocioId).then(({ apiKey, bankAccountId }) =>
      crearClientePey({ apiKey, bankAccountId, fetch: globalThis.fetch, modo }),
    );
    return clienteLive;
  };
  return {
    crearQr: async (entrada) => (await live()).crearQr(entrada),
    crearLink: async (entrada) => (await live()).crearLink(entrada),
    leerLink: async (id) => (await live()).leerLink(id),
    leerTransaccion: async (id) => (await live()).leerTransaccion(id),
    listarTransaccionesQr: async (id, nextToken) => (await live()).listarTransaccionesQr(id, nextToken),
    listarTransacciones: async (nextToken) => (await live()).listarTransacciones(nextToken),
    listarTransaccionesCuenta: async (nextToken) => (await live()).listarTransaccionesCuenta(nextToken),
    leerCuenta: async () => (await live()).leerCuenta(),
  };
}

export const simularYVerificar = internalAction({
  args: {
    negocioId: v.id("negocios"), intentoId: v.id("intentos"),
    variante: v.union(v.literal("exacto"), v.literal("monto_distinto"), v.literal("duplicado"), v.literal("tarjeta")),
  },
  returns: v.object({ ok: v.boolean(), resultado: v.string() }),
  handler: async (ctx, args): Promise<{ ok: boolean; resultado: string }> => {
    const modoConfigurado = await ctx.runQuery(internal.puertos.modoDeployment, {});
    const datos = await ctx.runQuery(internal.motor.verificar.datosIntento, { intentoId: args.intentoId });
    if (modoConfigurado !== "demo" || !datos || datos.negocioId !== args.negocioId || datos.modo !== "demo" || datos.modoNegocio !== "demo" || !datos.peyPayableId) {
      throw new ConvexError({ codigo: "SOLO_DEMO", mensaje: "La simulación solo está disponible en DEMO." });
    }
    const simulador = crearSimulador(crearStore(ctx, args.negocioId));
    await simulador.pagar(datos.peyPayableId, args.variante);
    return await ctx.runAction(internal.motor.verificar.verificarIntento, { intentoId: args.intentoId, origen: "simulador" });
  },
});
