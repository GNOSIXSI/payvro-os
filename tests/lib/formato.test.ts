import { describe, expect, it } from "vitest";
import { formatoMXN, pesosACentavos } from "../../lib/formato";

describe("pesosACentavos", () => {
  it("parses pesos typed by a person into integer centavos", () => {
    expect(pesosACentavos("0.01")).toBe(1);
    expect(pesosACentavos("450")).toBe(45_000);
    expect(pesosACentavos("1,340.00")).toBe(134_000);
    expect(pesosACentavos("0.1")).toBe(10);
    expect(pesosACentavos("450.5")).toBe(45_050);
  });

  it.each(["1.234", "-5", "0", "", "abc", "1e3"])("rejects %j", (texto) => {
    expect(() => pesosACentavos(texto)).toThrow();
  });
});

describe("formatoMXN", () => {
  it("formats centavos as Mexican pesos", () => {
    expect(formatoMXN(134_000)).toBe("$1,340.00");
  });
});
