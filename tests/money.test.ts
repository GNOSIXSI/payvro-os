import { describe, expect, it } from "vitest";
import {
  aCentavos,
  aPesos,
  MONTO_MAX_CENTAVOS,
  MONTO_MIN_CENTAVOS,
} from "../packages/engine/src/money";

describe("money conversion", () => {
  it("converts pesos to integer centavos without rounding invalid amounts", () => {
    expect(aCentavos(149)).toBe(14900);
    expect(aCentavos(0.01)).toBe(1);
    expect(aCentavos(0.1 + 0.2)).toBe(30);
    expect(MONTO_MIN_CENTAVOS).toBe(1);
    expect(MONTO_MAX_CENTAVOS).toBe(100_000_000);
  });

  it.each([149.999, -1, Number.NaN, Number.POSITIVE_INFINITY, 0])(
    "rejects invalid peso amount %s",
    (pesos) => {
      expect(() => aCentavos(pesos)).toThrow();
    },
  );

  it("converts centavos to pesos and round-trips valid amounts", () => {
    expect(aPesos(1)).toBe(0.01);

    for (let centavos = MONTO_MIN_CENTAVOS; centavos <= 100_000; centavos += 7) {
      expect(aCentavos(aPesos(centavos))).toBe(centavos);
    }
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, MONTO_MAX_CENTAVOS + 1])(
    "rejects invalid centavo amount %s",
    (centavos) => {
      expect(() => aPesos(centavos)).toThrow();
    },
  );
});
