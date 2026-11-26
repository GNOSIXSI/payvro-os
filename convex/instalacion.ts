import { nuevoId } from "@payvro/engine/ids";
import { ConvexError, v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { modo } from "./puertos";

export const instalarLive = internalMutation({
  args: {
    nombre: v.string(),
    giro: v.union(v.literal("social"), v.literal("citas"), v.literal("cotizaciones"), v.literal("mostrador"), v.literal("membresias"), v.literal("tienda")),
    colorMarca: v.union(v.literal("#076B76"), v.literal("#EF006D"), v.literal("#FF7900"), v.literal("#142B3B")),
  },
  returns: v.object({ creado: v.boolean() }),
  handler: async (ctx, { nombre, giro, colorMarca }) => {
    if (modo() !== "live") {
      throw new ConvexError({ codigo: "MODO_INVALIDO", mensaje: "El alta administrativa solo existe en LIVE." });
    }
    const demo = await ctx.db.query("negocios").withIndex("by_modo", (q) => q.eq("modo", "demo")).unique();
    if (demo) {
      throw new ConvexError({ codigo: "MODO_INVALIDO", mensaje: "Utiliza una instalación nueva, separada de DEMO." });
    }
    const existente = await ctx.db.query("negocios").withIndex("by_modo", (q) => q.eq("modo", "live")).unique();
    if (existente) return { creado: false };

    const nombreLimpio = nombre.trim();
    if (nombreLimpio.length < 1 || nombreLimpio.length > 40) {
      throw new ConvexError({ codigo: "TRANSICION_INVALIDA", mensaje: "El nombre debe tener entre 1 y 40 caracteres." });
    }
    const hoy = new Date();
    await ctx.db.insert("negocios", {
      publicId: nuevoId("neg_"), nombre: nombreLimpio, giro, colorMarca, modo: "live",
      cobrosPausados: false, folioSiguiente: 1, seqBitacora: 0, enRevisionCount: 0,
      verificadoHoyDia: Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate()),
      verificadoHoyCentavos: 0,
    });
    return { creado: true };
  },
});
