import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import type { Id, TableNames } from "../_generated/dataModel";

type FilaPurga = { _id: Id<TableNames>; _creationTime: number; modo?: string };

async function eliminarPaginaDemo(ctx: MutationCtx, filas: FilaPurga[], cutoff: number): Promise<number> {
  let eliminados = 0;
  for (const fila of filas) {
    if (fila.modo !== undefined && fila.modo !== "demo") {
      throw new ConvexError({ codigo: "SOLO_DEMO", mensaje: "La purga solo elimina datos DEMO." });
    }
    if (fila._creationTime <= cutoff) {
      await ctx.db.delete(fila._id);
      eliminados += 1;
    }
  }
  return eliminados;
}

const tablas = ["simTransacciones", "simPayables", "pagos", "intentos", "eventosPey", "cobros", "bitacora", "demoLimits"] as const;
const tablaValidator = v.union(
  v.literal("simTransacciones"), v.literal("simPayables"), v.literal("pagos"), v.literal("intentos"),
  v.literal("eventosPey"), v.literal("cobros"), v.literal("bitacora"), v.literal("demoLimits"),
);

export const purgarDemo = internalMutation({
  args: { tabla: tablaValidator, cursor: v.optional(v.union(v.string(), v.null())) },
  returns: v.object({ eliminados: v.number(), completado: v.boolean() }),
  handler: async (ctx, args) => {
    if (process.env.PAYVRO_MODE && process.env.PAYVRO_MODE !== "demo") {
      throw new ConvexError({ codigo: "SOLO_DEMO", mensaje: "La purga solo está disponible en DEMO." });
    }
    const live = await ctx.db.query("negocios").withIndex("by_modo", (q) => q.eq("modo", "live")).unique();
    if (live) throw new ConvexError({ codigo: "SOLO_DEMO", mensaje: "La purga solo está disponible en DEMO." });
    const negocio = await ctx.db.query("negocios").withIndex("by_modo", (q) => q.eq("modo", "demo")).unique();
    if (!negocio) return { eliminados: 0, completado: true };
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    let eliminados = 0;
    let isDone = true;
    let continueCursor: string | null = null;
    switch (args.tabla) {
      case "simTransacciones": {
        const page = await ctx.db.query("simTransacciones").withIndex("by_negocio_mode", (q) => q.eq("negocioId", negocio._id).eq("modo", "demo")).paginate({ numItems: 100, cursor: args.cursor ?? null });
        eliminados += await eliminarPaginaDemo(ctx, page.page, cutoff);
        isDone = page.isDone; continueCursor = page.continueCursor; break;
      }
      case "simPayables": {
        const page = await ctx.db.query("simPayables").withIndex("by_negocio", (q) => q.eq("negocioId", negocio._id)).paginate({ numItems: 100, cursor: args.cursor ?? null });
        eliminados += await eliminarPaginaDemo(ctx, page.page, cutoff);
        isDone = page.isDone; continueCursor = page.continueCursor; break;
      }
      case "pagos": {
        const page = await ctx.db.query("pagos").withIndex("by_negocio_verificadoEn", (q) => q.eq("negocioId", negocio._id).lte("verificadoEn", cutoff)).paginate({ numItems: 100, cursor: args.cursor ?? null });
        eliminados += await eliminarPaginaDemo(ctx, page.page, cutoff);
        isDone = page.isDone; continueCursor = page.continueCursor; break;
      }
      case "intentos": {
        const page = await ctx.db.query("intentos").withIndex("by_negocio_creadoEn", (q) => q.eq("negocioId", negocio._id).lte("creadoEn", cutoff)).paginate({ numItems: 100, cursor: args.cursor ?? null });
        eliminados += await eliminarPaginaDemo(ctx, page.page, cutoff);
        isDone = page.isDone; continueCursor = page.continueCursor; break;
      }
      case "eventosPey": {
        const page = await ctx.db.query("eventosPey").withIndex("by_negocio_recibidoEn", (q) => q.eq("negocioId", negocio._id).lte("recibidoEn", cutoff)).paginate({ numItems: 100, cursor: args.cursor ?? null });
        eliminados += await eliminarPaginaDemo(ctx, page.page, cutoff);
        isDone = page.isDone; continueCursor = page.continueCursor; break;
      }
      case "cobros": {
        const page = await ctx.db.query("cobros").withIndex("by_negocio_creadoEn", (q) => q.eq("negocioId", negocio._id).lte("creadoEn", cutoff)).paginate({ numItems: 100, cursor: args.cursor ?? null });
        eliminados += await eliminarPaginaDemo(ctx, page.page, cutoff);
        isDone = page.isDone; continueCursor = page.continueCursor; break;
      }
      case "bitacora": {
        const page = await ctx.db.query("bitacora").withIndex("by_negocio_en", (q) => q.eq("negocioId", negocio._id).lte("en", cutoff)).paginate({ numItems: 100, cursor: args.cursor ?? null });
        eliminados += await eliminarPaginaDemo(ctx, page.page, cutoff);
        isDone = page.isDone; continueCursor = page.continueCursor; break;
      }
      case "demoLimits": {
        const page = await ctx.db.query("demoLimits").withIndex("by_inicio", (q) => q.lte("inicio", cutoff)).paginate({ numItems: 100, cursor: args.cursor ?? null });
        eliminados += await eliminarPaginaDemo(ctx, page.page, cutoff);
        isDone = page.isDone; continueCursor = page.continueCursor; break;
      }
    }
    if (isDone) {
      const indice = tablas.indexOf(args.tabla);
      const siguiente = tablas[indice + 1];
      if (siguiente) await ctx.scheduler.runAfter(0, internal.motor.purga.purgarDemo, { tabla: siguiente, cursor: null });
    } else {
      await ctx.scheduler.runAfter(0, internal.motor.purga.purgarDemo, { tabla: args.tabla, cursor: continueCursor });
    }
    return { eliminados, completado: isDone && args.tabla === "demoLimits" };
  },
});
