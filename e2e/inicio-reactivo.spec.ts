import { expect, test, type Page, type WebSocketRoute } from "@playwright/test";
import { formatoMXN } from "../lib/formato";

const CREADO_EN = new Date("2026-11-15T18:00:00.000Z").getTime();
const DIA_MS = 24 * 60 * 60 * 1000;
const AHORA_POR_DEFECTO = CREADO_EN + 2 * DIA_MS;
const MONTO_MESA = 14_900;
const MONTO_FILA = 100;

type Fila = {
  publicId: string;
  folio: number;
  concepto: string;
  montoCentavos: number;
  estado: string;
  creadoEn: number;
};

type PaginaLista = {
  page: Fila[];
  isDone: boolean;
  continueCursor: string;
};

type Resumen = {
  verificadoHoyCentavos: number;
  porLiberar: number;
  enRevision: number;
};

type Consulta = {
  ruta: string;
  cursor: string | null;
};

type Version = {
  querySet: number;
  ts: number;
  identity: number;
};

type Alta = {
  type: "Add";
  queryId: number;
  udfPath: string;
  args: unknown[];
};

type Cambio = {
  type: "QueryUpdated";
  queryId: number;
  value: PaginaLista | Resumen | Negocio | null;
  logLines: string[];
  journal: null;
};

type Negocio = {
  nombre: string;
  giro: string;
  colorMarca: string;
  modo: "demo";
  cobrosPausados: boolean;
  cuentaLista: boolean;
};

type Frontera = {
  consultas: Map<number, Consulta>;
  version: Version;
  resumen: Resumen;
  paginas: Record<string, PaginaLista>;
  socket: WebSocketRoute | null;
};

const NEGOCIO: Negocio = {
  nombre: "Dulces Ana — Ejemplo",
  giro: "tienda",
  colorMarca: "#076B76",
  modo: "demo",
  cobrosPausados: false,
  cuentaLista: false,
};

test.describe("Inicio montado", () => {
  test.describe.configure({ timeout: 60_000 });

  test("pasa un cobro de Esperando pago a Liberado en la tabla y en la gráfica", async ({ page }) => {
    const frontera = crearFrontera(resumen(0), {
      "": paginaDe([fila(1, "Mesa uno", "esperando_pago", MONTO_MESA)], true, "1"),
    });
    await abrir(page, frontera);
    await expect(page.getByRole("table")).toContainText("Esperando pago");
    await expect(grafica(page)).toContainText(textoTotal(0));

    publicar(
      frontera,
      null,
      paginaDe([fila(1, "Mesa uno", "liberado", MONTO_MESA)], true, "1"),
      resumen(MONTO_MESA),
    );

    await expect(page.getByRole("row", { name: /Mesa uno/ })).toContainText("Liberado");
    await expect(grafica(page)).toContainText(textoTotal(MONTO_MESA));
  });

  test("mantiene viva la primera página después de cargar la segunda", async ({ page }) => {
    const primera = paginaAncha("esperando_pago");
    const frontera = crearFrontera(resumen(0), {
      "": primera,
      "50": paginaDe([fila(51, "Mesa dos", "liberado", MONTO_FILA)], true, "51"),
    });
    await abrir(page, frontera);
    await expect(page.getByRole("row", { name: /Mesa uno/ })).toContainText("Esperando pago");
    await expect(grafica(page)).toContainText(textoTotal(MONTO_FILA));

    publicar(frontera, null, liberarPrimero(primera));

    await expect(page.getByRole("row", { name: /Mesa uno/ })).toContainText("Liberado");
    await expect(grafica(page)).toContainText(textoTotal(MONTO_FILA * 2));
  });
});

test.describe("Gráfica en el borde del calendario de la ciudad de México", () => {
  test.describe.configure({ timeout: 60_000 });
  // The browser zone is far from the chart zone, so the host zone cannot decide the result.
  test.use({ timezoneId: "Asia/Tokyo" });

  test("cuenta solo los siete días de calendario que terminan hoy en la ciudad de México", async ({ page }) => {
    // 2026-11-21T03:30Z is 2026-11-20 21:30 in Mexico City: UTC and local dates differ.
    const ahora = Date.parse("2026-11-21T03:30:00.000Z");
    const frontera = crearFrontera(resumen(0), {
      "": paginaDe(
        [
          // Oldest included day, 14 Nov 01:00 local (07:00Z, still 14 Nov in UTC too).
          filaEn(1, 111, Date.parse("2026-11-14T07:00:00.000Z")),
          // Just outside: 13 Nov 23:59:59 local, which is already 14 Nov in UTC.
          filaEn(2, 222, Date.parse("2026-11-14T05:59:59.000Z")),
          // Newest included day: 20 Nov 20:00 local, which is 21 Nov in UTC.
          filaEn(3, 333, Date.parse("2026-11-21T02:00:00.000Z")),
          // Just outside: 21 Nov 00:00 local, tomorrow.
          filaEn(4, 444, Date.parse("2026-11-21T06:00:00.000Z")),
        ],
        true,
        "4",
      ),
    });
    await abrir(page, frontera, ahora);

    await expect(grafica(page)).toContainText(textoTotal(111 + 333));
    await expect(dia(page, "14 nov")).toContainText(formatoMXN(111));
    await expect(dia(page, "20 nov")).toContainText(formatoMXN(333));
    await expect(grafica(page).getByText("13 nov")).toHaveCount(0);
    await expect(grafica(page).getByText("21 nov")).toHaveCount(0);
  });
});

function crearFrontera(inicial: Resumen, paginas: Record<string, PaginaLista>): Frontera {
  return {
    consultas: new Map(),
    version: { querySet: 0, ts: 0, identity: 0 },
    resumen: inicial,
    paginas,
    socket: null,
  };
}

async function abrir(page: Page, frontera: Frontera, ahora: number = AHORA_POR_DEFECTO): Promise<void> {
  const fallos: string[] = [];
  page.on("pageerror", (error) => {
    fallos.push(error.message);
  });
  page.on("console", (mensaje) => {
    if (mensaje.type() === "error") {
      fallos.push(mensaje.text());
    }
  });
  await page.clock.install({ time: ahora });
  await enganchar(page, frontera);
  await page.goto("/panel");
  try {
    await page.getByRole("heading", { name: "Inicio" }).waitFor({ timeout: 15_000 });
  } catch (error) {
    const cuerpo = await page.locator("body").innerText();
    throw new Error(`${String(error)}\n${cuerpo}\n${fallos.join("\n")}`);
  }
}

async function enganchar(page: Page, frontera: Frontera): Promise<void> {
  await page.routeWebSocket(/\/sync/, (socket) => {
    reiniciar(frontera, socket);
    socket.onMessage((mensaje) => {
      const texto = textoJson(mensaje);
      if (texto) {
        recibir(frontera, texto);
      }
    });
  });
}

function reiniciar(frontera: Frontera, socket: WebSocketRoute): void {
  frontera.socket = socket;
  frontera.consultas.clear();
  frontera.version = { querySet: 0, ts: 0, identity: 0 };
}

function recibir(frontera: Frontera, texto: string): void {
  const mensaje = objeto(texto);
  if (!mensaje || mensaje.type !== "ModifyQuerySet" || !Array.isArray(mensaje.modifications)) {
    return;
  }
  if (typeof mensaje.newVersion !== "number") {
    return;
  }
  const altas = aplicar(frontera, mensaje.modifications);
  const cambios = altas.map((alta) => actualizacion(frontera, alta.queryId));
  emitir(frontera, mensaje.newVersion, cambios);
}

function aplicar(frontera: Frontera, modificaciones: unknown[]): Alta[] {
  const altas: Alta[] = [];
  for (const cambio of modificaciones) {
    const alta = comoAlta(cambio);
    if (alta) {
      frontera.consultas.set(alta.queryId, { ruta: alta.udfPath, cursor: cursorDe(alta.args) });
      altas.push(alta);
      continue;
    }
    const id = idBaja(cambio);
    if (id !== null) {
      frontera.consultas.delete(id);
    }
  }
  return altas;
}

function publicar(frontera: Frontera, cursor: string | null, pagina: PaginaLista, resumenNuevo?: Resumen): void {
  frontera.paginas[claveCursor(cursor)] = pagina;
  if (resumenNuevo) {
    frontera.resumen = resumenNuevo;
  }
  const cambios: Cambio[] = [];
  for (const [id, consulta] of frontera.consultas) {
    if (consulta.ruta.endsWith(":listar") && consulta.cursor === cursor) {
      cambios.push(actualizacion(frontera, id));
    }
    if (resumenNuevo && consulta.ruta.endsWith(":resumenDelDia")) {
      cambios.push(actualizacion(frontera, id));
    }
  }
  if (cambios.length > 0) {
    emitir(frontera, frontera.version.querySet, cambios);
  }
}

function actualizacion(frontera: Frontera, queryId: number): Cambio {
  const consulta = frontera.consultas.get(queryId);
  return {
    type: "QueryUpdated",
    queryId,
    value: valorDe(frontera, consulta),
    logLines: [],
    journal: null,
  };
}

function valorDe(frontera: Frontera, consulta: Consulta | undefined): PaginaLista | Resumen | Negocio | null {
  if (!consulta) {
    return null;
  }
  if (consulta.ruta.endsWith(":listar")) {
    return paginaDeCursor(frontera, consulta.cursor);
  }
  if (consulta.ruta.endsWith(":resumenDelDia")) {
    return frontera.resumen;
  }
  if (consulta.ruta.endsWith("negocio:obtener")) {
    return NEGOCIO;
  }
  return null;
}

function paginaDeCursor(frontera: Frontera, cursor: string | null): PaginaLista {
  return (
    frontera.paginas[claveCursor(cursor)] ?? {
      page: [],
      isDone: true,
      continueCursor: "",
    }
  );
}

function emitir(frontera: Frontera, querySet: number, modifications: Cambio[]): void {
  const inicio = frontera.version;
  const fin = { querySet, ts: inicio.ts + 1, identity: inicio.identity };
  frontera.version = fin;
  frontera.socket?.send(
    JSON.stringify({
      type: "Transition",
      startVersion: codificar(inicio),
      endVersion: codificar(fin),
      modifications,
    }),
  );
}

function codificar(marca: Version): { querySet: number; ts: string; identity: number } {
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

function comoAlta(cambio: unknown): Alta | null {
  if (!esRegistro(cambio) || cambio.type !== "Add" || typeof cambio.queryId !== "number") {
    return null;
  }
  if (typeof cambio.udfPath !== "string" || !Array.isArray(cambio.args)) {
    return null;
  }
  return { type: "Add", queryId: cambio.queryId, udfPath: cambio.udfPath, args: cambio.args };
}

function idBaja(cambio: unknown): number | null {
  if (!esRegistro(cambio) || cambio.type !== "Remove" || typeof cambio.queryId !== "number") {
    return null;
  }
  return cambio.queryId;
}

function cursorDe(args: unknown[]): string | null {
  const primero = args[0];
  if (!esRegistro(primero) || !esRegistro(primero.paginationOpts)) {
    return null;
  }
  const cursor = primero.paginationOpts.cursor;
  return typeof cursor === "string" ? cursor : null;
}

function claveCursor(cursor: string | null): string {
  return cursor ?? "";
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

function grafica(page: Page) {
  return page.getByRole("region", { name: "Cobros liberados por día de creación" });
}

function dia(page: Page, etiqueta: string) {
  return grafica(page).getByRole("listitem").filter({ hasText: etiqueta });
}

function textoTotal(centavos: number): string {
  return `Suma por día de creación: ${formatoMXN(centavos)}`;
}

function resumen(verificadoHoyCentavos: number): Resumen {
  return { verificadoHoyCentavos, porLiberar: 0, enRevision: 0 };
}

function fila(folio: number, concepto: string, estado: string, montoCentavos: number): Fila {
  return {
    publicId: `cob_${String(folio).padStart(26, "0")}`,
    folio,
    concepto,
    montoCentavos,
    estado,
    creadoEn: CREADO_EN,
  };
}

function filaEn(folio: number, montoCentavos: number, creadoEn: number): Fila {
  return { ...fila(folio, `Fila ${folio}`, "liberado", montoCentavos), creadoEn };
}

function paginaDe(page: Fila[], isDone: boolean, continueCursor: string): PaginaLista {
  return { page, isDone, continueCursor };
}

function paginaAncha(estadoPrimero: string): PaginaLista {
  const page: Fila[] = [];
  for (let indice = 0; indice < 50; indice += 1) {
    const folio = indice + 1;
    const concepto = indice === 0 ? "Mesa uno" : `Fila ${folio}`;
    const estado = indice === 0 ? estadoPrimero : "esperando_pago";
    page.push(fila(folio, concepto, estado, MONTO_FILA));
  }
  return paginaDe(page, false, "50");
}

function liberarPrimero(pagina: PaginaLista): PaginaLista {
  return paginaDe(
    pagina.page.map((cobro, indice) => (indice === 0 ? { ...cobro, estado: "liberado" } : cobro)),
    pagina.isDone,
    pagina.continueCursor,
  );
}
