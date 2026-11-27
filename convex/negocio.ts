import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { resolverNegocio, resolverNegocioEscritura } from "./puertos";
import { registrar } from "./motor/bitacora";
import { consumirLimite } from "./motor/limites";

const giro = v.union(v.literal("social"), v.literal("citas"), v.literal("cotizaciones"), v.literal("mostrador"), v.literal("membresias"), v.literal("tienda"));
const colorMarca = v.union(v.literal("#076B76"), v.literal("#EF006D"), v.literal("#FF7900"), v.literal("#142B3B"));
const modo = v.union(v.literal("demo"), v.literal("live"));
const negocioRespuesta = v.object({
  nombre: v.string(), giro, colorMarca, modo, cobrosPausados: v.boolean(), cuentaLista: v.boolean(),
});

export const obtener = query({
  args: {},
  returns: negocioRespuesta,
  handler: async (ctx) => {
    const { negocioId, modo: modoResuelto } = await resolverNegocio(ctx);
    const negocio = await ctx.db.get(negocioId);
    if (!negocio || negocio.modo !== modoResuelto) {
      throw new ConvexError({ codigo: "MODO_INVALIDO", mensaje: "El modo del negocio no coincide con la instalación." });
    }
    return {
      nombre: negocio.nombre, giro: negocio.giro as "social" | "citas" | "cotizaciones" | "mostrador" | "membresias" | "tienda",
      colorMarca: negocio.colorMarca as "#076B76" | "#EF006D" | "#FF7900" | "#142B3B",
      modo: negocio.modo, cobrosPausados: negocio.cobrosPausados, cuentaLista: negocio.modo === "demo",
    };
  },
});

export const preparar = mutation({
  args: {},
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx) => {
    const { modo: modoResuelto } = await resolverNegocioEscritura(ctx);
    if (modoResuelto !== "demo") {
      throw new ConvexError({ codigo: "SOLO_DEMO", mensaje: "La preparación automática solo existe en DEMO." });
    }
    return { ok: true };
  },
});

export const actualizarPerfil = mutation({
  args: { nombre: v.string(), giro, colorMarca },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args) => {
    const { negocioId, modo: modoResuelto, actor } = await resolverNegocioEscritura(ctx);
    if (args.nombre.trim().length < 1 || args.nombre.length > 40) {
      throw new ConvexError({ codigo: "TRANSICION_INVALIDA", mensaje: "El nombre debe tener entre 1 y 40 caracteres." });
    }
    const negocio = await ctx.db.get(negocioId);
    if (!negocio || negocio.modo !== modoResuelto) {
      throw new ConvexError({ codigo: "MODO_INVALIDO", mensaje: "El modo del negocio no coincide con la instalación." });
    }
    if (modoResuelto === "demo") await consumirLimite(ctx, `perfil:${negocioId}`, 10);
    await ctx.db.patch(negocioId, { nombre: args.nombre, giro: args.giro, colorMarca: args.colorMarca });
    await registrar(ctx, {
      negocioId, modo: modoResuelto, tipo: "negocio.actualizado", actor, detalle: {},
    });
    return { ok: true };
  },
});
