import { describe, expect, it } from "vitest";
import {
  crearPuenteNombre,
  observarClienteNombre,
  recordarConsulta,
  responderNombre,
  vaciarNombreNegocio,
} from "../../e2e/rewriter-nombre";

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

describe("responderNombre", () => {
  it("keeps a rejected profile save as a failure and leaves the remote name empty", () => {
    const puente = prepararPuente();
    const rechazo = JSON.stringify({
      type: "MutationResponse",
      requestId: 7,
      success: false,
      result: "Uncaught ConvexError: NO_IMPLEMENTADO",
      logLines: [],
      errorData: { codigo: "NO_IMPLEMENTADO", mensaje: "La actualización del perfil todavía no está disponible." },
    });

    const salida = responderNombre(puente, rechazo, false);

    expect(salida.mensaje).toBe(rechazo);
    expect(salida.extra).toBeNull();
    expect(puente.nombreAceptado).toBeNull();
  });

  it("turns an accepted save into the name later queries return", () => {
    const puente = prepararPuente();
    const salida = responderNombre(
      puente,
      JSON.stringify({
        type: "MutationResponse",
        requestId: 7,
        success: false,
        result: "Uncaught ConvexError: NO_IMPLEMENTADO",
        logLines: [],
        errorData: { codigo: "NO_IMPLEMENTADO", mensaje: "La actualización del perfil todavía no está disponible." },
      }),
      true,
    );
    const exito = JSON.parse(salida.mensaje) as { success?: boolean; result?: { ok?: boolean } };
    const extra = JSON.parse(salida.extra ?? "{}") as {
      type?: string;
      modifications?: Array<{ value?: { nombre?: string; modo?: string } }>;
    };

    expect(exito.success).toBe(true);
    expect(exito.result).toEqual({ ok: true });
    expect(extra.type).toBe("Transition");
    expect(extra.modifications?.[0]?.value?.nombre).toBe("Negocio de ejemplo");
    expect(extra.modifications?.[0]?.value?.modo).toBe("demo");
    expect(puente.nombreAceptado).toBe("Negocio de ejemplo");

    const siguiente = JSON.parse(
      responderNombre(
        puente,
        JSON.stringify({
          type: "Transition",
          startVersion: { querySet: 1, ts: "AAAA", identity: 0 },
          endVersion: { querySet: 2, ts: "BBBB", identity: 0 },
          modifications: [
            { type: "QueryUpdated", queryId: 3, value: { nombre: "Dulces Ana — Ejemplo", modo: "demo" }, logLines: [], journal: null },
          ],
        }),
        true,
      ).mensaje,
    ) as { modifications: Array<{ value: { nombre?: string } }> };

    expect(siguiente.modifications[0]?.value.nombre).toBe("Negocio de ejemplo");
  });
});

function prepararPuente() {
  const puente = crearPuenteNombre();
  observarClienteNombre(
    puente,
    JSON.stringify({
      type: "ModifyQuerySet",
      modifications: [{ type: "Add", queryId: 3, udfPath: "negocio:obtener", args: [{}] }],
    }),
  );
  responderNombre(
    puente,
    JSON.stringify({
      type: "Transition",
      startVersion: { querySet: 0, ts: "AAAA", identity: 0 },
      endVersion: { querySet: 1, ts: "AAAA", identity: 0 },
      modifications: [
        {
          type: "QueryUpdated",
          queryId: 3,
          value: { nombre: "Dulces Ana — Ejemplo", modo: "demo", giro: "tienda" },
          logLines: [],
          journal: null,
        },
      ],
    }),
    false,
  );
  observarClienteNombre(
    puente,
    JSON.stringify({
      type: "Mutation",
      requestId: 7,
      udfPath: "negocio:actualizarPerfil",
      args: [{ nombre: "Negocio de ejemplo", giro: "social", colorMarca: "#076B76" }],
    }),
  );
  return puente;
}
