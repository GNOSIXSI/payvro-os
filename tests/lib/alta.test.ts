import { describe, expect, it } from "vitest";
import { decidirAlta, interpretarAlta, PERFIL_OMITIDO } from "../../components/alta-local";

const DEMO = "Dulces Ana — Ejemplo";
const GUARDADO = {
  nombre: "Negocio de ejemplo",
  giro: "social" as const,
  colorMarca: "#076B76" as const,
};

describe("decidirAlta", () => {
  it("does not open the assistant when Convex already has a name", () => {
    const decision = decidirAlta({
      hayConvex: true,
      nombreRemoto: "Dulces Ana — Ejemplo",
      altaLocal: "pendiente",
      nombreDemo: DEMO,
    });

    expect(decision.mostrarAsistente).toBe(false);
    expect(decision.nombre).toBe("Dulces Ana — Ejemplo");
  });

  it("opens the assistant when Convex has no name, even if this browser saved one", () => {
    const decision = decidirAlta({
      hayConvex: true,
      nombreRemoto: "  ",
      altaLocal: GUARDADO,
      nombreDemo: DEMO,
    });

    expect(decision.mostrarAsistente).toBe(true);
    expect(decision.nombre).toBe("");
  });

  it("waits without redirecting while the Convex profile is still loading", () => {
    const decision = decidirAlta({
      hayConvex: true,
      nombreRemoto: undefined,
      altaLocal: "pendiente",
      nombreDemo: DEMO,
    });

    expect(decision.mostrarAsistente).toBe(false);
    expect(decision.nombre).toBe("");
  });

  it("keeps the demo business when this browser has no alta flag", () => {
    const decision = decidirAlta({
      hayConvex: false,
      nombreRemoto: undefined,
      altaLocal: null,
      nombreDemo: DEMO,
    });

    expect(decision.mostrarAsistente).toBe(false);
    expect(decision.nombre).toBe(DEMO);
  });

  it("opens the assistant in DEMO only when the session is explicitly pending", () => {
    const decision = decidirAlta({
      hayConvex: false,
      nombreRemoto: DEMO,
      altaLocal: "pendiente",
      nombreDemo: DEMO,
    });

    expect(decision.mostrarAsistente).toBe(true);
    expect(decision.nombre).toBe("");
  });

  it("uses the saved session profile in DEMO and ignores the remote name", () => {
    const decision = decidirAlta({
      hayConvex: false,
      nombreRemoto: "",
      altaLocal: GUARDADO,
      nombreDemo: DEMO,
    });

    expect(decision.mostrarAsistente).toBe(false);
    expect(decision.nombre).toBe("Negocio de ejemplo");
  });

  it("ships a non-empty omit profile that will not send the owner back to the assistant", () => {
    const decision = decidirAlta({
      hayConvex: false,
      nombreRemoto: undefined,
      altaLocal: PERFIL_OMITIDO,
      nombreDemo: DEMO,
    });

    expect(PERFIL_OMITIDO.nombre.trim().length).toBeGreaterThan(0);
    expect(PERFIL_OMITIDO.nombre.length).toBeLessThanOrEqual(40);
    expect(decision.mostrarAsistente).toBe(false);
    expect(decision.nombre).toBe(PERFIL_OMITIDO.nombre);
  });
});

describe("interpretarAlta", () => {
  it("stays off unless the session is the exact pending flag or a valid profile", () => {
    expect(interpretarAlta(null)).toBeNull();
    expect(interpretarAlta("pendiente")).toBe("pendiente");
    expect(interpretarAlta("pendiente ")).toBeNull();
    expect(interpretarAlta("{")).toBeNull();
    expect(interpretarAlta(JSON.stringify({ nombre: "Negocio de ejemplo", giro: "no", colorMarca: "#076B76" }))).toBeNull();
    expect(interpretarAlta(JSON.stringify(GUARDADO))).toEqual(GUARDADO);
  });
});
