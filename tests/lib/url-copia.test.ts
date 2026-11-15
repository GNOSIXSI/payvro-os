import { afterEach, describe, expect, it } from "vitest";
import { destinoDeCopia } from "../../lib/url-copia";

const AVISO = "El link de pago aún no está disponible";
const COBRO = "cob_00000000000000000000000000";

function conUbicacion(ubicacion: { protocol: string; hostname: string; origin: string }) {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: { location: ubicacion },
  });
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, "window");
});

describe("destinoDeCopia", () => {
  it("copies the PAYVRO URL on an https host", () => {
    conUbicacion({
      protocol: "https:",
      hostname: "pay.example",
      origin: "https://pay.example",
    });
    expect(destinoDeCopia(COBRO, undefined)).toEqual({
      disponible: true,
      etiqueta: "Copiar link",
      texto: `https://pay.example/pagar/${COBRO}`,
    });
  });

  it("copies urlPago when the host is localhost", () => {
    conUbicacion({
      protocol: "http:",
      hostname: "localhost",
      origin: "http://localhost:3000",
    });
    expect(destinoDeCopia(COBRO, "https://pay.pey.example/c/1")).toEqual({
      disponible: true,
      etiqueta: "Copiar link de pey",
      texto: "https://pay.pey.example/c/1",
    });
  });

  it.each(["localhost", "127.0.0.1"])(
    "does not copy a %s link when urlPago is missing",
    (hostname) => {
      conUbicacion({
        protocol: "http:",
        hostname,
        origin: `http://${hostname}:3000`,
      });
      expect(destinoDeCopia(COBRO, undefined)).toEqual({
        disponible: false,
        aviso: AVISO,
      });
    },
  );
});
