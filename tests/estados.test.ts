import { describe, expect, it } from "vitest";
import { transicionarCobro, transicionarIntento } from "../packages/engine/src/estados";

describe("state transitions", () => {
  it.each([
    ["borrador", "intento_creado", "esperando_pago"], ["borrador", "cancelar", "cancelado"],
    ["esperando_pago", "coincide", "pagado_verificado"], ["esperando_pago", "revisar", "en_revision"],
    ["esperando_pago", "expirar", "expirado"], ["esperando_pago", "cancelar", "cancelado"],
    ["pagado_verificado", "liberar", "liberado"], ["expirado", "pago_tardio", "en_revision"],
    ["cancelado", "pago_tardio", "en_revision"],
  ] as const)("transitions %s on %s", (estado, evento, siguiente) => {
    expect(transicionarCobro(estado, evento)).toBe(siguiente);
  });
  it("rejects illegal payment-state jumps", () => {
    expect(() => transicionarCobro("borrador", "coincide")).toThrow("TRANSICION_INVALIDA");
    expect(() => transicionarCobro("liberado", "cancelar")).toThrow("TRANSICION_INVALIDA");
  });
  it.each([
    ["reservado", "crear", "creado"], ["reservado", "incierto", "incierto"],
    ["reservado", "fallar", "fallido"], ["creado", "pagar", "pagado"],
    ["creado", "descartar", "descartado"], ["incierto", "descartar", "descartado"],
  ] as const)("attempt transitions %s on %s", (estado, evento, siguiente) => {
    expect(transicionarIntento(estado, evento)).toBe(siguiente);
  });
  it("rejects retrying an unknown outcome", () => {
    expect(() => transicionarIntento("incierto", "crear")).toThrow("TRANSICION_INVALIDA");
  });
});
