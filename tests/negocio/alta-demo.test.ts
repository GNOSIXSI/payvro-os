import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import { decidirAlta, debeSalirDeBienvenida } from "../../components/alta-local";

function nuevoHarness() {
  return convexTest(schema, import.meta.glob("../../convex/**/*.ts"));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-14T12:00:00.000Z"));
  vi.stubEnv("PAYVRO_MODE", "demo");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("alta de un negocio DEMO recién creado", () => {
  it("no trae nombre, así que /bienvenida no se salta, y actualizarPerfil lo persiste", async () => {
    const t = nuevoHarness();
    await t.mutation(api.cobros.crear, {
      claveIdempotencia: "alta-demo-00000001",
      concepto: "Pedido de ejemplo",
      montoCentavos: 100,
    });
    const fresco = await t.query(api.negocio.obtener, {});
    const abierto = decidirAlta({
      hayConvex: true,
      nombreRemoto: fresco.nombre,
      altaLocal: null,
      nombreDemo: "Dulces Ana — Ejemplo",
    });

    expect(fresco.nombre).toBe("");
    expect(abierto.mostrarAsistente).toBe(true);
    expect(
      debeSalirDeBienvenida({ lista: true, esperandoPerfil: false, mostrarAsistente: abierto.mostrarAsistente }),
    ).toBe(false);

    await t.mutation(api.negocio.actualizarPerfil, {
      nombre: "Negocio de ejemplo",
      giro: "social",
      colorMarca: "#076B76",
    });
    const guardado = await t.query(api.negocio.obtener, {});
    const cerrado = decidirAlta({
      hayConvex: true,
      nombreRemoto: guardado.nombre,
      altaLocal: null,
      nombreDemo: "Dulces Ana — Ejemplo",
    });

    expect(guardado.nombre).toBe("Negocio de ejemplo");
    expect(cerrado.mostrarAsistente).toBe(false);
    expect(cerrado.nombre).toBe("Negocio de ejemplo");
  });
});
