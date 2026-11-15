import { createServer, type Server } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type Page } from "playwright";
import { build, type Rollup } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { formatoMXN } from "../../lib/formato";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CREADO_EN = new Date("2026-11-15T18:00:00.000Z").getTime();
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

type Escena = {
  resumen: Resumen;
  paginas: Record<string, PaginaLista>;
};

let codigo = "";
let navegador: Browser;
let servidor: Server;
let origen = "";

describe("Inicio montado", () => {
  beforeAll(async () => {
    codigo = await empaquetarInicio();
    navegador = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
    servidor = createServer((req, respuesta) => {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      const escena = escenaDe(url.searchParams.get("e"));
      respuesta.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      respuesta.end(html(escena, codigo));
    });
    await new Promise<void>((resolver) => {
      servidor.listen(0, "127.0.0.1", () => resolver());
    });
    const direccion = servidor.address();
    if (!direccion || typeof direccion === "string") {
      throw new Error("el servidor de prueba no expuso un puerto");
    }
    origen = `http://127.0.0.1:${direccion.port}`;
  }, 120_000);

  afterAll(async () => {
    await navegador?.close();
    await new Promise<void>((resolver, rechazar) => {
      if (!servidor) {
        resolver();
        return;
      }
      servidor.close((error) => (error ? rechazar(error) : resolver()));
    });
  });

  it("pasa un cobro de Esperando pago a Liberado en la tabla y en la gráfica", async () => {
    const pagina = paginaDe([fila(1, "Mesa uno", "esperando_pago", MONTO_MESA)], true, "1");
    const page = await abrir({
      resumen: resumen(0),
      paginas: { "": pagina },
    });
    expect(await leer(page.getByRole("table"))).toContain("Esperando pago");
    expect(await leer(grafica(page))).toContain(textoTotal(0));

    await page.evaluate(
      ({ cursor, paginaNueva, resumenNuevo }) => {
        window.__inicio.reemplazarLista(cursor, paginaNueva, resumenNuevo);
      },
      {
        cursor: null,
        paginaNueva: paginaDe([fila(1, "Mesa uno", "liberado", MONTO_MESA)], true, "1"),
        resumenNuevo: resumen(MONTO_MESA),
      },
    );

    await expect.poll(() => leer(page.getByRole("row", { name: /Mesa uno/ }))).toContain("Liberado");
    expect(await leer(grafica(page))).toContain(textoTotal(MONTO_MESA));
    await page.close();
  }, 60_000);

  it("mantiene viva la primera página después de cargar la segunda", async () => {
    const primera = paginaDe(
      Array.from({ length: 50 }, (_, indice) => fila(indice + 1, indice === 0 ? "Mesa uno" : `Fila ${indice + 1}`, "esperando_pago", MONTO_FILA)),
      false,
      "50",
    );
    const segunda = paginaDe([fila(51, "Mesa dos", "liberado", MONTO_FILA)], true, "51");
    const page = await abrir({
      resumen: resumen(0),
      paginas: { "": primera, "50": segunda },
    });
    expect(await leer(page.getByRole("row", { name: /Mesa uno/ }))).toContain("Esperando pago");
    expect(await leer(grafica(page))).toContain(textoTotal(MONTO_FILA));

    const actualizada = paginaDe(
      primera.page.map((cobro, indice) => (indice === 0 ? { ...cobro, estado: "liberado" } : cobro)),
      false,
      "50",
    );
    await page.evaluate(
      ({ cursor, paginaNueva }) => {
        window.__inicio.reemplazarLista(cursor, paginaNueva);
      },
      { cursor: null, paginaNueva: actualizada },
    );

    await expect.poll(() => leer(page.getByRole("row", { name: /Mesa uno/ }))).toContain("Liberado");
    expect(await leer(grafica(page))).toContain(textoTotal(MONTO_FILA * 2));
    await page.close();
  }, 60_000);
});

async function abrir(escena: Escena): Promise<Page> {
  const page = await navegador.newPage({ viewport: { width: 1280, height: 900 } });
  const fallos: string[] = [];
  page.on("pageerror", (error) => {
    fallos.push(error.message);
  });
  await page.goto(`${origen}/?e=${encodeURIComponent(JSON.stringify(escena))}`);
  try {
    await page.getByRole("heading", { name: "Inicio" }).waitFor({ timeout: 8_000 });
  } catch (error) {
    const cuerpo = await page.locator("body").innerText();
    const remoto = await page.evaluate(() => window.__inicio?.errores ?? []);
    throw new Error(`${String(error)}\n${cuerpo}\n${remoto.join("\n")}\n${fallos.join("\n")}`);
  }
  return page;
}

async function leer(localizador: ReturnType<Page["getByRole"]>): Promise<string> {
  return localizador.innerText();
}

function grafica(page: Page) {
  return page.getByRole("region", { name: "Cobros liberados por día de creación" });
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

function paginaDe(page: Fila[], isDone: boolean, continueCursor: string): PaginaLista {
  return { page, isDone, continueCursor };
}

function escenaDe(crudo: string | null): Escena {
  if (!crudo) {
    throw new Error("falta la escena");
  }
  return JSON.parse(crudo) as Escena;
}

function html(escena: Escena, bundle: string): string {
  const seguro = bundle.replaceAll("</script", "<\\/script");
  return `<!doctype html><html><head><meta charset="utf-8"></head><body><div id="root"></div><script>window.__escena=${JSON.stringify(escena).replaceAll("<", "\\u003c")}</script><script>${seguro}</script></body></html>`;
}

async function empaquetarInicio(): Promise<string> {
  const resultado = await build({
    configFile: false,
    root: RAIZ,
    logLevel: "silent",
    define: {
      "process.env.NEXT_PUBLIC_CONVEX_URL": JSON.stringify("https://happy-animal-123.convex.cloud"),
      "process.env.NODE_ENV": JSON.stringify("test"),
    },
    resolve: {
      alias: {
        "@": RAIZ,
        "next/link": path.join(RAIZ, "tests/panel/puente-next-link.tsx"),
        "next/dynamic": path.join(RAIZ, "tests/panel/puente-next-dynamic.tsx"),
      },
    },
    esbuild: { jsx: "automatic" },
    build: {
      write: false,
      minify: false,
      target: "es2022",
      rollupOptions: {
        input: path.join(RAIZ, "tests/panel/entrada-inicio.tsx"),
        output: { format: "iife", inlineDynamicImports: true },
      },
    },
  });
  const salida = Array.isArray(resultado) ? resultado[0] : resultado;
  if (!salida || !("output" in salida)) {
    throw new Error("vite no devolvió el bundle");
  }
  const entrada = salida.output.find((parte: Rollup.OutputChunk | Rollup.OutputAsset) => parte.type === "chunk" && parte.isEntry);
  if (!entrada || entrada.type !== "chunk") {
    throw new Error("vite no devolvió el chunk de entrada");
  }
  return entrada.code;
}

declare global {
  interface Window {
    __inicio: {
      errores: string[];
      reemplazarLista: (
        cursor: string | null,
        pagina: PaginaLista,
        resumenNuevo?: Resumen,
      ) => void;
    };
  }
}
