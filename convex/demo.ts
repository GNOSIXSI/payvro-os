// STUB WP-OS-01 — replaced by WP-OS-02
import { ConvexError, v } from "convex/values";
import { mutation } from "./_generated/server";

export const simularPago = mutation({
  args: {
    publicId: v.string(),
    variante: v.union(
      v.literal("exacto"),
      v.literal("monto_distinto"),
      v.literal("duplicado"),
      v.literal("tarjeta"),
    ),
  },
  returns: v.object({ ok: v.boolean() }),
  handler: async () => {
    throw new ConvexError({
      codigo: "NO_IMPLEMENTADO",
      mensaje: "La simulación de pagos todavía no está disponible.",
    });
  },
});
