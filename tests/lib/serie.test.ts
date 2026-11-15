import { describe, expect, it } from "vitest";
import { serieIngresos, type CobroParaSerie } from "../../lib/serie";

const AHORA = new Date("2026-11-15T21:00:00.000Z");
const AYER_2359_MEXICO = new Date("2026-11-15T05:59:00.000Z");
const HOY_0030_MEXICO = new Date("2026-11-15T06:30:00.000Z");

describe("serieIngresos", () => {
  it("returns seven Mexico City days when there are no cobros", () => {
    const serie = serieIngresos([], AHORA);

    expect(serie).toHaveLength(7);
    expect(serie.map((dia) => dia.clave)).toEqual([
      "2026-11-09",
      "2026-11-10",
      "2026-11-11",
      "2026-11-12",
      "2026-11-13",
      "2026-11-14",
      "2026-11-15",
    ]);
    expect(serie.every((dia) => dia.centavos === 0)).toBe(true);
  });

  it("sums only pagado_verificado and liberado as integer centavos", () => {
    const serie = serieIngresos(
      [
        cobro("borrador", 100, AHORA),
        cobro("en_revision", 200, AHORA),
        cobro("pagado_verificado", 300, AHORA),
        cobro("liberado", 400, AHORA),
        cobro("cancelado", 500, AHORA),
        cobro("esperando_pago", 600, AHORA),
        cobro("expirado", 700, AHORA),
        cobro("pagado_verificado", 10.5, AHORA),
      ],
      AHORA,
    );

    expect(serie[6]?.centavos).toBe(700);
    expect(Number.isInteger(serie[6]?.centavos)).toBe(true);
    expect(serie.slice(0, 6).every((dia) => dia.centavos === 0)).toBe(true);
  });

  it("keeps a cobro from yesterday at 23:59 on yesterday in America/Mexico_City", () => {
    const serie = serieIngresos(
      [
        cobro("liberado", 1_500, AYER_2359_MEXICO),
        cobro("pagado_verificado", 50, AYER_2359_MEXICO),
        cobro("esperando_pago", 9_999, AYER_2359_MEXICO),
        cobro("liberado", 25, HOY_0030_MEXICO),
      ],
      AHORA,
    );

    expect(serie.find((dia) => dia.clave === "2026-11-14")?.centavos).toBe(1_550);
    expect(serie.find((dia) => dia.clave === "2026-11-15")?.centavos).toBe(25);
  });

  it("does not open an eighth day for a cobro older than the window", () => {
    const fuera = new Date("2026-11-08T18:00:00.000Z");
    const serie = serieIngresos([cobro("liberado", 8_000, fuera)], AHORA);

    expect(serie).toHaveLength(7);
    expect(serie.every((dia) => dia.centavos === 0)).toBe(true);
  });
});

function cobro(estado: string, montoCentavos: number, cuando: Date): CobroParaSerie {
  return { estado, montoCentavos, creadoEn: cuando.getTime() };
}
