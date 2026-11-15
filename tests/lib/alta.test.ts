import { describe, expect, it } from "vitest";
import { cerrarAlta, decidirAlta, interpretarAlta, PERFIL_OMITIDO, debeSalirDeBienvenida } from "../../components/alta-local";

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

  it("does not treat a local profile as saved while Convex still has no name", () => {
    const decision = decidirAlta({
      hayConvex: true,
      nombreRemoto: "  ",
      altaLocal: GUARDADO,
      nombreDemo: DEMO,
    });

    expect(decision.mostrarAsistente).toBe(true);
    expect(decision.nombre).toBe("");
  });

  it("hides the assistant after an explicit skip even when Convex has no name", () => {
    const decision = decidirAlta({
      hayConvex: true,
      nombreRemoto: "",
      altaLocal: "omitido",
      nombreDemo: DEMO,
    });

    expect(decision.mostrarAsistente).toBe(false);
    expect(decision.nombre).toBe(PERFIL_OMITIDO.nombre);
  });

  it("opens the assistant when Convex has no name and this browser has not finished", () => {
    const decision = decidirAlta({
      hayConvex: true,
      nombreRemoto: "",
      altaLocal: "pendiente",
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

describe("debeSalirDeBienvenida", () => {
  it("stays on bienvenida while Convex has not answered and leaves once a named profile arrives", () => {
    expect(debeSalirDeBienvenida({ lista: true, esperandoPerfil: true, mostrarAsistente: false })).toBe(false);
    expect(debeSalirDeBienvenida({ lista: false, esperandoPerfil: false, mostrarAsistente: false })).toBe(false);
    expect(debeSalirDeBienvenida({ lista: true, esperandoPerfil: false, mostrarAsistente: true })).toBe(false);
    expect(debeSalirDeBienvenida({ lista: true, esperandoPerfil: false, mostrarAsistente: false })).toBe(true);
  });
});

describe("cerrarAlta", () => {
  const noImplementado = {
    data: { codigo: "NO_IMPLEMENTADO", mensaje: "La actualización del perfil todavía no está disponible." },
  };

  it("keeps the form when saving fails, including NO_IMPLEMENTADO, and never marks it saved", () => {
    expect(cerrarAlta("guardar", noImplementado)).toEqual({
      navegar: false,
      marcarOmitido: false,
      mostrarError: true,
    });
    expect(cerrarAlta("guardar", { data: { codigo: "DATOS_INVALIDOS", mensaje: "Revisa el nombre." } })).toEqual({
      navegar: false,
      marcarOmitido: false,
      mostrarError: true,
    });
    expect(cerrarAlta("guardar", new Error("red"))).toEqual({
      navegar: false,
      marcarOmitido: false,
      mostrarError: true,
    });
  });

  it("navigates after the server accepts a save without writing a local skip", () => {
    expect(cerrarAlta("guardar", null)).toEqual({
      navegar: true,
      marcarOmitido: false,
      mostrarError: false,
    });
  });

  it("treats Omitir as a local skip that does not depend on the server", () => {
    expect(cerrarAlta("omitir", noImplementado)).toEqual({
      navegar: true,
      marcarOmitido: true,
      mostrarError: false,
    });
    expect(cerrarAlta("omitir", null)).toEqual({
      navegar: true,
      marcarOmitido: true,
      mostrarError: false,
    });
  });
});

describe("interpretarAlta", () => {
  it("stays off unless the session is the exact pending flag or a valid profile", () => {
    expect(interpretarAlta(null)).toBeNull();
    expect(interpretarAlta("pendiente")).toBe("pendiente");
    expect(interpretarAlta("omitido")).toBe("omitido");
    expect(interpretarAlta("pendiente ")).toBeNull();
    expect(interpretarAlta("{")).toBeNull();
    expect(interpretarAlta(JSON.stringify({ nombre: "Negocio de ejemplo", giro: "no", colorMarca: "#076B76" }))).toBeNull();
    expect(interpretarAlta(JSON.stringify(GUARDADO))).toEqual(GUARDADO);
  });
});
