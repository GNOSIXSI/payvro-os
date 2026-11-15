import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";

export async function consumirLimite(
  ctx: MutationCtx,
  clave: string,
  maximo: number,
  ventanaMs = 60_000,
): Promise<void> {
  const ahora = Date.now();
  const registro = await ctx.db.query("demoLimits").withIndex("by_clave", (q) => q.eq("clave", clave)).unique();
  if (!registro || ahora - registro.inicio >= ventanaMs) {
    if (registro) await ctx.db.patch(registro._id, { inicio: ahora, cantidad: 1 });
    else await ctx.db.insert("demoLimits", { clave, inicio: ahora, cantidad: 1 });
    return;
  }
  if (registro.cantidad >= maximo) {
    throw new ConvexError({ codigo: "DEMASIADAS_SOLICITUDES", mensaje: "Espera un momento antes de volver a intentarlo." });
  }
  await ctx.db.patch(registro._id, { cantidad: registro.cantidad + 1 });
}
