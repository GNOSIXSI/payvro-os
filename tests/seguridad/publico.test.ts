import { afterEach, expect, it, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import { nuevoId } from "@payvro/engine/ids";
import { insertarIntentoLive, insertarNegocioLive, nuevoLiveHarness } from "../motor/live-support";

afterEach(() => vi.unstubAllEnvs());

it("proyecta el mismo null para un id ausente, mal formado o de otro modo", async () => {
  vi.stubEnv("PAYVRO_MODE", "demo");
  const t = nuevoLiveHarness();
  const negocio = await insertarNegocioLive(t);
  const otroModo = await insertarIntentoLive(t, negocio);
  for (const publicId of [nuevoId("cob_"), "cob_no-valido", otroModo.cobroPublicId]) {
    await expect(t.query(api.publico.cobro, { publicId })).resolves.toBeNull();
  }
  // Even a matching-mode cobro with a mismatched or missing parent is unavailable.
  await t.run(async (ctx) => ctx.db.patch(otroModo.cobroId, { modo: "demo" }));
  await expect(t.query(api.publico.cobro, { publicId: otroModo.cobroPublicId })).resolves.toBeNull();
  await t.run(async (ctx) => ctx.db.delete(negocio));
  await expect(t.query(api.publico.cobro, { publicId: otroModo.cobroPublicId })).resolves.toBeNull();
});

it("conserva la proyección exacta de un cobro disponible para un pagador anónimo", async () => {
  vi.stubEnv("PAYVRO_MODE", "live");
  const t = nuevoLiveHarness();
  const { cobroPublicId, intentoId } = await insertarIntentoLive(t, await insertarNegocioLive(t));
  await t.run(async (ctx) => ctx.db.patch(intentoId, { qrString: "QR de ejemplo" }));
  await expect(t.query(api.publico.cobro, { publicId: cobroPublicId })).resolves.toEqual({
    negocio: { nombre: "Dulces Ana — Ejemplo", colorMarca: "#076B76" }, folio: 1,
    concepto: "Pedido de ejemplo", montoCentavos: 1, estadoVisible: "Esperando pago", qrString: "QR de ejemplo", modo: "live",
  });
});
