import { expect, test, type WebSocketRoute } from "@playwright/test";

const PUBLIC_ID = "cob_00000000000000000000000001";
const QR = "PAYVRO-LIVE:cob_00000000000000000000000001";

type Marca = { querySet: number; ts: number; identity: number };

test("un pagador sin sesión ve el cobro LIVE aunque negocio.obtener lo niegue", async ({ page }) => {
  const enviados: string[] = [];
  await page.routeWebSocket(/\/sync/, (socket) => {
    const marca: Marca = { querySet: 0, ts: 0, identity: 0 };
    socket.onMessage((mensaje) => {
      const texto = textoJson(mensaje);
      if (!texto) {
        return;
      }
      enviados.push(texto);
      atender(socket, marca, texto);
    });
  });

  await page.goto(`/pagar/${PUBLIC_ID}`);
  await expect(page.getByText("$450.00")).toBeVisible();
  await expect(page.getByText("Esperando pago", { exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: "Código QR CoDi" })).toBeVisible();
  await expect(page.getByText("No se pudo cargar la cuenta.")).toHaveCount(0);
  await expect.poll(() => enviados.join("\n")).toContain("publico:vigilar");
  expect(enviados.join("\n")).not.toContain("negocio:obtener");
});

test("la portada no consulta negocio.obtener aunque esa consulta niegue al dueño", async ({ page }) => {
  const enviados: string[] = [];
  await page.routeWebSocket(/\/sync/, (socket) => {
    const marca: Marca = { querySet: 0, ts: 0, identity: 0 };
    socket.onMessage((mensaje) => {
      const texto = textoJson(mensaje);
      if (!texto) {
        return;
      }
      enviados.push(texto);
      atender(socket, marca, texto);
    });
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Cobra y libera, sin comprobantes." })).toBeVisible();
  await expect(page.getByText("DEMO", { exact: true })).toBeVisible();
  await expect(page.getByText("No se pudo cargar la cuenta.")).toHaveCount(0);
  await expect.poll(() => enviados.join("\n")).toContain("publico:instalacion");
  expect(enviados.join("\n")).not.toContain("negocio:obtener");
});

function atender(socket: WebSocketRoute, marca: Marca, texto: string): void {
  const data = objeto(texto);
  if (!data || data.type !== "ModifyQuerySet" || !Array.isArray(data.modifications)) {
    return;
  }
  if (typeof data.newVersion !== "number") {
    return;
  }
  const cambios = data.modifications.flatMap((mod) => cambioDe(mod));
  if (cambios.length === 0) {
    return;
  }
  emitir(socket, marca, data.newVersion, cambios);
}

function cambioDe(mod: unknown): Cambio[] {
  if (!esRegistro(mod) || mod.type !== "Add" || typeof mod.queryId !== "number") {
    return [];
  }
  if (mod.udfPath === "negocio:obtener") {
    return [falloDueno(mod.queryId)];
  }
  if (mod.udfPath === "publico:cobro") {
    return [cobroDe(mod.queryId)];
  }
  if (mod.udfPath === "publico:instalacion") {
    return [instalacionDe(mod.queryId)];
  }
  return [];
}

type Cambio =
  | {
      type: "QueryFailed";
      queryId: number;
      errorMessage: string;
      errorData: { codigo: string; mensaje: string };
      logLines: string[];
    }
  | {
      type: "QueryUpdated";
      queryId: number;
      value: CobroPublico | { modo: "demo" };
      logLines: string[];
      journal: null;
    };

function falloDueno(queryId: number): Cambio {
  return {
    type: "QueryFailed",
    queryId,
    errorMessage: "Uncaught ConvexError: No tienes permiso para operar este negocio.",
    errorData: { codigo: "NO_AUTORIZADO", mensaje: "No tienes permiso para operar este negocio." },
    logLines: [],
  };
}

function instalacionDe(queryId: number): Cambio {
  return {
    type: "QueryUpdated",
    queryId,
    value: { modo: "demo" },
    logLines: [],
    journal: null,
  };
}

function cobroDe(queryId: number): Cambio {
  return {
    type: "QueryUpdated",
    queryId,
    value: {
      negocio: { nombre: "Puesto de ejemplo", colorMarca: "#076B76" },
      folio: 7,
      concepto: "Pedido de prueba",
      montoCentavos: 45_000,
      estadoVisible: "Esperando pago",
      qrString: QR,
      modo: "live",
    },
    logLines: [],
    journal: null,
  };
}

type CobroPublico = {
  negocio: { nombre: string; colorMarca: string };
  folio: number;
  concepto: string;
  montoCentavos: number;
  estadoVisible: string;
  qrString: string;
  modo: "live";
};

function emitir(socket: WebSocketRoute, marca: Marca, querySet: number, modifications: Cambio[]): void {
  const inicio = { ...marca };
  marca.querySet = querySet;
  marca.ts += 1;
  socket.send(
    JSON.stringify({
      type: "Transition",
      startVersion: codificar(inicio),
      endVersion: codificar(marca),
      modifications,
    }),
  );
}

function codificar(marca: Marca): { querySet: number; ts: string; identity: number } {
  return { querySet: marca.querySet, ts: u64(marca.ts), identity: marca.identity };
}

function u64(valor: number): string {
  const bytes = new Uint8Array(8);
  let resto = valor;
  for (let indice = 0; indice < bytes.length; indice += 1) {
    bytes[indice] = resto % 256;
    resto = Math.floor(resto / 256);
  }
  let binario = "";
  for (const byte of bytes) {
    binario += String.fromCharCode(byte);
  }
  return btoa(binario);
}

function textoJson(mensaje: string | Buffer): string | null {
  const texto = typeof mensaje === "string" ? mensaje : mensaje.toString("utf8");
  return texto.startsWith("{") ? texto : null;
}

function objeto(texto: string): Record<string, unknown> | null {
  try {
    const data: unknown = JSON.parse(texto);
    return esRegistro(data) ? data : null;
  } catch (fallo: unknown) {
    if (fallo instanceof SyntaxError) {
      return null;
    }
    throw fallo;
  }
}

function esRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}
