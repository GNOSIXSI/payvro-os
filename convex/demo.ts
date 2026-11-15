import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { mutation } from "./_generated/server";
import { resolverNegocio, modo } from "./puertos";
import { consumirLimite } from "./motor/limites";
import { esId } from "@payvro/engine/ids";

const variante = v.union(v.literal("exacto"), v.literal("monto_distinto"), v.literal("duplicado"), v.literal("tarjeta"));

export const simularPago = mutation({
  args: { publicId: v.string(), variante },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args) => {
    if (modo() !== "demo") {
      throw new ConvexError({ codigo: "SOLO_DEMO", mensaje: "La simulación solo está disponible en DEMO." });
    }
    if (!esId("cob_", args.publicId)) return { ok: false };
    const { negocioId, modo: modoResuelto } = await resolverNegocio(ctx);
    if (modoResuelto !== "demo") {
      throw new ConvexError({ codigo: "SOLO_DEMO", mensaje: "La simulación solo está disponible en DEMO." });
    }
    const cobro = await ctx.db.query("cobros").withIndex("by_publicId", (q) => q.eq("publicId", args.publicId)).unique();
    if (!cobro || cobro.negocioId !== negocioId || cobro.modo !== "demo") return { ok: false };
    if (!cobro.intentoActivoId) return { ok: false };
    await consumirLimite(ctx, `simular:${negocioId}`, 20);
    await ctx.scheduler.runAfter(0, internal.motor.peyPuerto.simularYVerificar, {
      negocioId, intentoId: cobro.intentoActivoId, variante: args.variante,
    });
    return { ok: true };
  },
});
