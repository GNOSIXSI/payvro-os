import { describe, expect, it } from "vitest";
import { agrupaPorCreacion, leerMarcas, rotuloIngresos, serieIngresos, type CobroParaSerie } from "../../lib/serie";

const AHORA = new Date("2026-11-15T21:00:00.000Z");
const AYER_2359_MEXICO = new Date("2026-11-15T05:59:00.000Z");
const HOY_0030_MEXICO = new Date("2026-11-15T06:30:00.000Z");

describe("rotuloIngresos", () => {
  it("does not present creation-day buckets as daily income or a weekly total", () => {
    expect(rotuloIngresos({ porCreacion: true, parcial: false })).toEqual({
      titulo: "Cobros liberados por día de creación",
      prefijo: "Suma por día de creación",
      aviso: null,
    });
    expect(rotuloIngresos({ porCreacion: true, parcial: true })).toEqual({
      titulo: "Cobros liberados por día de creación",
      prefijo: "Suma por día de creación",
      aviso: "Datos parciales",
    });
    expect(rotuloIngresos({ porCreacion: false, parcial: true }).prefijo).toBe("Suma de la muestra");
    expect(rotuloIngresos({ porCreacion: false, parcial: true }).aviso).toBe("Datos parciales");
    expect(rotuloIngresos({ porCreacion: false, parcial: false })).toEqual({
      titulo: "Ingresos de los últimos 7 días",
      prefijo: "Total de la semana",
      aviso: null,
    });
  });
});

describe("agrupaPorCreacion", () => {
  it("is true unless every counted cobro brings a verified or release timestamp", () => {
    expect(agrupaPorCreacion([])).toBe(true);
    expect(agrupaPorCreacion([cobro("liberado", 100, AHORA)])).toBe(true);
    expect(
      agrupaPorCreacion([
        { estado: "liberado", montoCentavos: 100, creadoEn: AHORA.getTime(), verificadoEn: AHORA.getTime() },
      ]),
    ).toBe(false);
    expect(leerMarcas({ creadoEn: 1 })).toEqual({});
    expect(leerMarcas({ verificadoEn: 5, liberadoEn: 9.5 })).toEqual({ verificadoEn: 5 });
  });
});

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

  it("puts a cobro paid after midnight on the verified day, not the creation day", () => {
    const creado = new Date("2026-11-15T05:55:00.000Z");
    const verificado = new Date("2026-11-15T06:05:00.000Z");
    const serie = serieIngresos(
      [
        {
          estado: "liberado",
          montoCentavos: 14_900,
          creadoEn: creado.getTime(),
          verificadoEn: verificado.getTime(),
        },
      ],
      AHORA,
    );

    expect(serie.find((dia) => dia.clave === "2026-11-15")?.centavos).toBe(14_900);
    expect(serie.find((dia) => dia.clave === "2026-11-14")?.centavos).toBe(0);
  });

  it("uses the release timestamp when a liberated cobro has both marks", () => {
    const creado = new Date("2026-11-15T05:55:00.000Z");
    const liberado = new Date("2026-11-15T06:05:00.000Z");
    const serie = serieIngresos(
      [
        {
          estado: "liberado",
          montoCentavos: 100,
          creadoEn: creado.getTime(),
          verificadoEn: creado.getTime(),
          liberadoEn: liberado.getTime(),
        },
      ],
      AHORA,
    );

    expect(serie.find((dia) => dia.clave === "2026-11-15")?.centavos).toBe(100);
    expect(serie.find((dia) => dia.clave === "2026-11-14")?.centavos).toBe(0);
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
