import { describe, expect, it } from "vitest";
import { recordarConsulta, vaciarNombreNegocio } from "../../e2e/rewriter-nombre";

describe("vaciarNombreNegocio", () => {
  it("clears only the negocio.obtener result and keeps the cobro page", () => {
    const ids = new Set<number>();
    recordarConsulta(
      ids,
      JSON.stringify({
        type: "ModifyQuerySet",
        modifications: [
          { type: "Add", queryId: 3, udfPath: "negocio:obtener", args: [{}] },
          { type: "Add", queryId: 4, udfPath: "cobros:listar", args: [{}] },
        ],
      }),
    );

    const salida = vaciarNombreNegocio(
      ids,
      JSON.stringify({
        type: "Transition",
        modifications: [
          { type: "QueryUpdated", queryId: 3, value: { nombre: "Dulces Ana — Ejemplo", modo: "demo" } },
          { type: "QueryUpdated", queryId: 4, value: { page: [{ publicId: "cob_00000000000000000000000000" }] } },
        ],
      }),
    );
    const data = JSON.parse(salida) as {
      modifications: Array<{ value: { nombre?: string; modo?: string; page?: unknown[] } }>;
    };

    expect(data.modifications[0]?.value.nombre).toBe("");
    expect(data.modifications[0]?.value.modo).toBe("demo");
    expect(data.modifications[1]?.value.page).toEqual([{ publicId: "cob_00000000000000000000000000" }]);
  });

  it("returns an unrelated frame byte for byte", () => {
    const crudo = JSON.stringify({ type: "Ping" });
    expect(vaciarNombreNegocio(new Set([1]), crudo)).toBe(crudo);
  });
});
