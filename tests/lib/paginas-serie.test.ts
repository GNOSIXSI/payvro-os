import { describe, expect, it } from "vitest";
import { serieIngresos } from "../../lib/serie";
import { juntarPaginas, textoSuma, MAX_PAGINAS_SERIE, TAMANO_PAGINA_SERIE } from "../../lib/paginas-serie";

const AHORA = new Date("2026-11-15T21:00:00.000Z");

describe("juntarPaginas", () => {
  it("sums every liberated cobro in the week, not only the first page of 50", () => {
    const cobros = Array.from({ length: 51 }, (_, indice) => ({
      estado: "liberado",
      montoCentavos: 100,
      creadoEn: AHORA.getTime(),
      marca: indice,
    }));
    const estado = juntarPaginas([
      { page: cobros.slice(0, TAMANO_PAGINA_SERIE), isDone: false, continueCursor: "50" },
      { page: cobros.slice(TAMANO_PAGINA_SERIE), isDone: true, continueCursor: "51" },
    ]);
    const total = serieIngresos(estado.filas, AHORA).reduce((suma, dia) => suma + dia.centavos, 0);

    expect(estado.filas).toHaveLength(51);
    expect(estado.parcial).toBe(false);
    expect(total).toBe(5_100);
  });

  it("stops at 10 pages and marks the series partial instead of calling it complete", () => {
    const estado = juntarPaginas(
      Array.from({ length: MAX_PAGINAS_SERIE + 1 }, (_, indice) => ({
        page: Array.from({ length: TAMANO_PAGINA_SERIE }, () => ({
          estado: "liberado",
          montoCentavos: 100,
          creadoEn: AHORA.getTime(),
        })),
        isDone: false,
        continueCursor: String((indice + 1) * TAMANO_PAGINA_SERIE),
      })),
    );

    expect(estado.paginas).toBe(MAX_PAGINAS_SERIE);
    expect(estado.filas).toHaveLength(TAMANO_PAGINA_SERIE * MAX_PAGINAS_SERIE);
    expect(estado.parcial).toBe(true);
    expect(estado.completo).toBe(true);
    expect(textoSuma(true)).toEqual({ prefijo: "Suma de la muestra", aviso: "Datos parciales" });
    expect(textoSuma(true).prefijo).not.toBe("Total de la semana");
  });
});
