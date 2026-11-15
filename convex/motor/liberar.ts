import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { transicionarCobro } from "@payvro/engine";
import { registrar } from "./bitacora";

export async function liberar(
  ctx: MutationCtx,
  cobro: Doc<"cobros">,
  negocio: Doc<"negocios">,
  actor: { tipo: "dueno" | "sistema" | "pey" | "agente" | "pagador" | "simulador"; id?: string },
  ahora = Date.now(),
): Promise<void> {
  if (cobro.liberadoEn !== undefined || cobro.estado === "liberado") return;
  if (cobro.estado !== "pagado_verificado" || cobro.negocioId !== negocio._id || cobro.modo !== negocio.modo) {
    throw new ConvexError({ codigo: "TRANSICION_INVALIDA", mensaje: "El cobro no está listo para liberar." });
  }
  const nuevoEstado = transicionarCobro(cobro.estado, "liberar");
  await ctx.db.patch(cobro._id, { estado: nuevoEstado, liberadoEn: ahora, actualizadoEn: ahora });
  await registrar(ctx, {
    negocioId: negocio._id, modo: negocio.modo, tipo: "cobro.liberado", cobroId: cobro._id,
    ...(cobro.intentoActivoId ? { intentoId: cobro.intentoActivoId } : {}),
    ...(cobro.pagoId ? { pagoId: cobro.pagoId } : {}),
    actor, estadoAntes: cobro.estado, estadoDespues: nuevoEstado, detalle: {}, en: ahora,
  });
}
