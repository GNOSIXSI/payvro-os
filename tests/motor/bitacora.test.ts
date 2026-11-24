import { describe, expect, it } from "vitest";
import { registrar } from "../../convex/motor/bitacora";
import { insertarIntentoLive, insertarNegocioLive, nuevoLiveHarness } from "./live-support";

describe("unreadable pey event detail contract", () => {
  it("accepts an empty detail and rejects every detail key without appending", async () => {
    const t = nuevoLiveHarness();
    const negocioId = await insertarNegocioLive(t);
    const { cobroId, intentoId } = await insertarIntentoLive(t, negocioId);
    const entrada = { negocioId, modo: "live" as const, tipo: "pey.dato_ilegible", cobroId, intentoId, actor: { tipo: "pey" as const } };
    await expect(t.run((ctx) => registrar(ctx, { ...entrada, detalle: {} }))).resolves.toMatch(/^bit_/);
    // Existing valid detail keys must also be forbidden for this event.
    for (const detalle of [{ motivo: "monto_distinto" }, { httpStatus: 500 }, { requestId: "example" }, { operacion: "crear_qr" }, { extra: true }]) {
      await expect(t.run((ctx) => registrar(ctx, { ...entrada, detalle })))
        .rejects.toMatchObject({ data: { codigo: "TRANSICION_INVALIDA" } });
    }
    const rows = await t.run((ctx) => ctx.db.query("bitacora").withIndex("by_cobro_seq", (q) => q.eq("cobroId", cobroId)).collect());
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ tipo: "pey.dato_ilegible", detalle: {} });
  });
});
