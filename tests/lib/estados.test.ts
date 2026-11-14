import { describe, expect, it } from "vitest";
import {
  ESTADOS_COBRO,
  estadoParaDueno,
  estadoParaPagador,
} from "../../lib/estados";

describe("estado labels", () => {
  it("gives every cobro state a non-empty label for owner and payer", () => {
    expect(ESTADOS_COBRO.length).toBeGreaterThan(0);

    for (const estado of ESTADOS_COBRO) {
      expect(estadoParaDueno(estado).etiqueta.trim().length).toBeGreaterThan(0);
      expect(estadoParaPagador(estado).etiqueta.trim().length).toBeGreaterThan(0);
    }
  });

  it("uses the amber chip only for esperando_pago", () => {
    for (const estado of ESTADOS_COBRO) {
      if (estado === "esperando_pago") {
        expect(estadoParaDueno(estado).chip).toBe("amber");
        expect(estadoParaPagador(estado).chip).toBe("amber");
      } else {
        expect(estadoParaDueno(estado).chip).not.toBe("amber");
        expect(estadoParaPagador(estado).chip).not.toBe("amber");
      }
    }
  });
});
