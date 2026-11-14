// STUB WP-OS-01 — replaced by WP-OS-02
import { ConvexError, v } from "convex/values";
import { NEGOCIO_FIXTURE } from "./_stub/fixtures";
import { mutation, query } from "./_generated/server";

const giroValidator = v.union(
  v.literal("social"),
  v.literal("citas"),
  v.literal("cotizaciones"),
  v.literal("mostrador"),
  v.literal("membresias"),
  v.literal("tienda"),
);

const colorMarcaValidator = v.union(
  v.literal("#076B76"),
  v.literal("#EF006D"),
  v.literal("#FF7900"),
  v.literal("#142B3B"),
);

const negocioValidator = v.object({
  nombre: v.string(),
  giro: giroValidator,
  colorMarca: colorMarcaValidator,
  modo: v.union(v.literal("demo"), v.literal("live")),
  cobrosPausados: v.boolean(),
  cuentaLista: v.boolean(),
});

export const obtener = query({
  args: {},
  returns: negocioValidator,
  handler: async () => NEGOCIO_FIXTURE,
});

export const actualizarPerfil = mutation({
  args: {
    nombre: v.string(),
    giro: giroValidator,
    colorMarca: colorMarcaValidator,
  },
  returns: v.object({ ok: v.boolean() }),
  handler: async () => {
    throw new ConvexError({
      codigo: "NO_IMPLEMENTADO",
      mensaje: "La actualización del perfil todavía no está disponible.",
    });
  },
});
