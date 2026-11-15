import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction, internalMutation, internalQuery } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { crearPeyPuerto } from "./peyPuerto";

const estadoCuenta = v.union(
  v.literal("ACTIVE"), v.literal("PENDING"), v.literal("PROCESSING"), v.literal("ERROR"),
  v.literal("CONFIGURACION_AUSENTE"), v.literal("NO_DISPONIBLE"),
);
type EstadoCuenta = "ACTIVE" | "PENDING" | "PROCESSING" | "ERROR" | "CONFIGURACION_AUSENTE" | "NO_DISPONIBLE";

export const negocioLive = internalQuery({
  args: {},
  returns: v.union(v.null(), v.object({ negocioId: v.id("negocios") })),
  handler: async (ctx) => {
    const negocio = await ctx.db.query("negocios").withIndex("by_modo", (q) => q.eq("modo", "live")).unique();
    return negocio ? { negocioId: negocio._id } : null;
  },
});

export const guardarEstado = internalMutation({
  args: { negocioId: v.id("negocios"), estado: estadoCuenta },
  returns: v.null(),
  handler: async (ctx, args) => {
    const negocio = await ctx.db.get(args.negocioId);
    if (!negocio || negocio.modo !== "live") {
      throw new ConvexError({ codigo: "MODO_INVALIDO", mensaje: "La revisión de cuenta solo está disponible en LIVE." });
    }
    await ctx.db.patch(negocio._id, { estadoCuentaPey: args.estado, cuentaRevisadaEn: Date.now() });
    return null;
  },
});

function codigoError(error: unknown): string | undefined {
  if (!(error instanceof ConvexError) || typeof error.data !== "object" || error.data === null || !("codigo" in error.data)) return undefined;
  return typeof error.data.codigo === "string" ? error.data.codigo : undefined;
}

async function leerEstadoCuenta(ctx: ActionCtx, negocioId: Id<"negocios">): Promise<EstadoCuenta> {
  try {
    const resultado = await crearPeyPuerto(ctx, negocioId, "live").leerCuenta();
    switch (resultado.codiStatus) {
      case "ACTIVE":
      case "PENDING":
      case "PROCESSING":
      case "ERROR":
        return resultado.codiStatus;
      default:
        return "NO_DISPONIBLE";
    }
  } catch (error) {
    return codigoError(error) === "CUENTA_NO_ACTIVA" ? "CONFIGURACION_AUSENTE" : "NO_DISPONIBLE";
  }
}

export const comprobarCuenta = internalAction({
  args: {},
  returns: v.object({ ok: v.boolean(), estado: estadoCuenta }),
  handler: async (ctx): Promise<{ ok: boolean; estado: EstadoCuenta }> => {
    const modo = await ctx.runQuery(internal.puertos.modoDeployment, {});
    if (modo !== "live") return { ok: false, estado: "NO_DISPONIBLE" };
    const negocio = await ctx.runQuery(internal.motor.cuenta.negocioLive, {});
    if (!negocio) return { ok: false, estado: "NO_DISPONIBLE" };
    const estado = await leerEstadoCuenta(ctx, negocio.negocioId);
    await ctx.runMutation(internal.motor.cuenta.guardarEstado, { negocioId: negocio.negocioId, estado });
    return { ok: estado === "ACTIVE", estado };
  },
});
