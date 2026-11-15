import { describe, expect, it } from "vitest";
import { colorTextoMarca, contraste, NEGRO, TINTA, BLANCO } from "../../lib/contraste";
import { COLORES_MARCA } from "../../lib/negocio-opciones";

describe("colorTextoMarca", () => {
  it("reaches 4.5:1 for every allowed brand color", () => {
    for (const fondo of COLORES_MARCA) {
      expect(contraste(colorTextoMarca(fondo), fondo)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("uses white on the dark brand colors and ink on orange", () => {
    expect(colorTextoMarca("#076B76")).toBe(BLANCO);
    expect(colorTextoMarca("#142B3B")).toBe(BLANCO);
    expect(colorTextoMarca("#FF7900")).toBe(TINTA);
  });

  it("rejects white and ink on the pink that misses 4.5:1", () => {
    expect(contraste(BLANCO, "#EF006D")).toBeLessThan(4.5);
    expect(contraste(TINTA, "#EF006D")).toBeLessThan(4.5);
    expect(colorTextoMarca("#EF006D")).toBe(NEGRO);
    expect(contraste(NEGRO, "#EF006D")).toBeGreaterThanOrEqual(4.5);
  });
});
