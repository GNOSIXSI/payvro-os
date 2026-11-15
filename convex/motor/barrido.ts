import { v } from "convex/values";
import type { RegisteredAction, RegisteredMutation } from "convex/server";
import { internal } from "../_generated/api";
import { internalAction, internalMutation } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

const LIMITE_POR_EJECUCION = 20;
const ANTIGUEDAD_CREACION_MS = 45_000;
const VENTANA_DESCARTADOS_MS = 24 * 60 * 60 * 1000;

export const seleccionarIntentos: RegisteredMutation<"internal", Record<string, never>, Id<"intentos">[]> = internalMutation({
  args: {},
  returns: v.array(v.id("intentos")),
  handler: async (ctx) => {
    const ahora = Date.now();
    const [creados, descartados] = await Promise.all([
      ctx.db.query("intentos")
        .withIndex("by_modo_estado_barridoEn", (q) => q.eq("modo", "live").eq("estado", "creado").eq("barridoActivo", true).lte("siguienteBarridoEn", ahora))
        .take(LIMITE_POR_EJECUCION),
      ctx.db.query("intentos")
        .withIndex("by_modo_estado_barridoEn", (q) => q.eq("modo", "live").eq("estado", "descartado").eq("barridoActivo", true).lte("siguienteBarridoEn", ahora))
        .take(LIMITE_POR_EJECUCION),
    ]);
    const candidatos = [...creados, ...descartados].sort((a, b) => a.creadoEn - b.creadoEn);
    const elegibles: Id<"intentos">[] = [];
    for (const intento of candidatos) {
      if (elegibles.length === LIMITE_POR_EJECUCION) break;
      const cobro = await ctx.db.get(intento.cobroId);
      const descartadoReciente = intento.estado === "descartado" && intento.peyPayableId !== undefined && cobro != null && cobro.creadoEn >= ahora - VENTANA_DESCARTADOS_MS;
      const creadoEsperando = intento.estado === "creado" && cobro?.estado === "esperando_pago" && intento.creadoEn <= ahora - ANTIGUEDAD_CREACION_MS;
      const debeSeguir = intento.tipo === "qr" && (creadoEsperando || descartadoReciente);
      if (!debeSeguir) {
        if (intento.estado === "descartado" || (intento.estado === "creado" && cobro?.estado !== "esperando_pago")) {
          await ctx.db.patch(intento._id, { barridoActivo: false, siguienteBarridoEn: undefined });
        }
        continue;
      }
      elegibles.push(intento._id);
    }
    return elegibles;
  },
});

export const recuperar: RegisteredAction<"internal", Record<string, never>, { revisados: number }> = internalAction({
  args: {},
  returns: v.object({ revisados: v.number() }),
  handler: async (ctx) => {
    const modo = await ctx.runQuery(internal.puertos.modoDeployment, {});
    if (modo !== "live") return { revisados: 0 };
    const intentos = await ctx.runMutation(internal.motor.barrido.seleccionarIntentos, {});
    for (const intentoId of intentos) {
      try {
        await ctx.runAction(internal.motor.verificar.verificarIntento, { intentoId, origen: "barrido" });
      } catch {
        // A failed verification is deferred by the caller; do not fan out or retry a POST here.
      }
    }
    return { revisados: intentos.length };
  },
});
