import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { internalQuery } from "./_generated/server";
import type { ActionCtx, MutationCtx, QueryCtx } from "./_generated/server";
import type { Modo, PuertosMotor, ResolucionNegocio } from "./motor/puertos";
import { nuevoId } from "@payvro/engine/ids";

export function modo(): Modo {
  const configurado = process.env.PAYVRO_MODE;
  if (configurado === undefined || configurado === "") return "demo";
  if (configurado !== "demo" && configurado !== "live") {
    throw new ConvexError({ codigo: "MODO_INVALIDO", mensaje: "El modo de instalación no es válido." });
  }
  return configurado;
}

async function negocioPorModo(ctx: QueryCtx | MutationCtx, esperado: Modo) {
  const negocio = await ctx.db.query("negocios").withIndex("by_modo", (q) => q.eq("modo", esperado)).unique();
  if (!negocio) {
    const otroModo = esperado === "demo" ? "live" : "demo";
    const persistidoDistinto = await ctx.db.query("negocios").withIndex("by_modo", (q) => q.eq("modo", otroModo)).unique();
    if (persistidoDistinto) {
      throw new ConvexError({ codigo: "MODO_INVALIDO", mensaje: "El modo del negocio no coincide con la instalación." });
    }
  }
  if (negocio && negocio.modo !== modo()) {
    throw new ConvexError({ codigo: "MODO_INVALIDO", mensaje: "El modo del negocio no coincide con la instalación." });
  }
  return negocio;
}

async function actorAutorizado(ctx: QueryCtx | MutationCtx, modoInstalacion: Modo): Promise<ResolucionNegocio["actor"]> {
  if (modoInstalacion === "demo") return { tipo: "simulador" };
  const identidad = await ctx.auth.getUserIdentity();
  const claims = identidad as unknown as { email?: string; emailVerified?: boolean; email_verified?: boolean } | null;
  const email = claims?.email?.trim().toLowerCase();
  const verificado = claims?.emailVerified === true || claims?.email_verified === true;
  const permitidos = (process.env.PAYVRO_OWNER_EMAILS ?? "")
    .split(",")
    .map((valor) => valor.trim().toLowerCase())
    .filter(Boolean);
  if (!identidad || !email || !verificado || !permitidos.includes(email)) {
    throw new ConvexError({ codigo: "NO_AUTORIZADO", mensaje: "No tienes permiso para operar este negocio." });
  }
  return { tipo: "dueno", id: identidad.subject };
}

export async function resolverNegocio(ctx: QueryCtx | MutationCtx): Promise<ResolucionNegocio> {
  const modoInstalacion = modo();
  const negocio = await negocioPorModo(ctx, modoInstalacion);
  if (!negocio) {
    throw new ConvexError({ codigo: "NO_ENCONTRADO", mensaje: "El negocio todavía no está configurado." });
  }
  const actor = await actorAutorizado(ctx, modoInstalacion);
  return { negocioId: negocio._id, modo: negocio.modo, actor };
}

export async function resolverNegocioEscritura(ctx: MutationCtx): Promise<ResolucionNegocio> {
  const modoInstalacion = modo();
  let negocio = await negocioPorModo(ctx, modoInstalacion);
  if (!negocio && modoInstalacion === "demo") {
    const id: Id<"negocios"> = await ctx.db.insert("negocios", {
      publicId: nuevoId("neg_"),
      nombre: "Dulces Ana — Ejemplo",
      giro: "social",
      colorMarca: "#076B76",
      modo: "demo",
      cobrosPausados: false,
      folioSiguiente: 1,
      seqBitacora: 0,
      enRevisionCount: 0,
      verificadoHoyDia: Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()),
      verificadoHoyCentavos: 0,
    });
    negocio = await ctx.db.get(id);
  }
  if (!negocio) {
    throw new ConvexError({ codigo: "NO_ENCONTRADO", mensaje: "El negocio todavía no está configurado." });
  }
  const actor = await actorAutorizado(ctx, modoInstalacion);
  return { negocioId: negocio._id, modo: negocio.modo, actor };
}

export async function credencialPey(ctx: ActionCtx, negocioId: Id<"negocios">) {
  const modoPersistido = await ctx.runQuery(internal.puertos.modoNegocio, { negocioId });
  if (modo() !== modoPersistido || modoPersistido !== "live") {
    throw new ConvexError({ codigo: "MODO_INVALIDO", mensaje: "No se pueden leer credenciales en este modo." });
  }
  const apiKey = process.env.PEY_API_KEY;
  const bankAccountId = process.env.PEY_BANK_ACCOUNT_ID;
  if (!apiKey || !bankAccountId) {
    throw new ConvexError({ codigo: "MODO_INVALIDO", mensaje: "Falta la configuración de pagos." });
  }
  return { apiKey, bankAccountId, ...(process.env.PEY_WEBHOOK_SECRET ? { webhookSecret: process.env.PEY_WEBHOOK_SECRET } : {}) };
}

export function urlsRetorno(cobroPublicId: string) {
  const origin = process.env.PAYVRO_PUBLIC_URL?.replace(/\/$/, "");
  const base = origin ? `${origin}/pagar/${encodeURIComponent(cobroPublicId)}` : "https://example.invalid/volver";
  return { successUrl: base, backUrl: base };
}

export const modoNegocio = internalQuery({
  args: { negocioId: v.id("negocios") },
  returns: v.union(v.null(), v.literal("demo"), v.literal("live")),
  handler: async (ctx, args) => (await ctx.db.get(args.negocioId))?.modo ?? null,
});

export const modoDeployment = internalQuery({
  args: {},
  returns: v.union(v.literal("demo"), v.literal("live")),
  handler: async () => modo(),
});

export const puertosMotor: PuertosMotor = { modo, resolverNegocio, resolverNegocioEscritura, credencialPey, urlsRetorno };
