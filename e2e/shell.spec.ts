import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { entrarAlPanel } from "./entrar-panel";

const NUBE = ["Plantillas", "Mostrador", "Plan", "Agente"] as const;
const RECHAZO = "La actualización del perfil todavía no está disponible.";

test.describe.serial("alta DEMO contra el servidor", () => {
test("negocio sin nombre redirige /panel a /bienvenida", async ({ page }) => {
  await page.goto("/panel");
  await expect(page).toHaveURL(/\/bienvenida$/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Cuenta" })).toBeVisible();
});

test("si el servidor rechaza el perfil, el formulario sigue y no queda guardado", async ({ page }) => {
  await rechazarGuardado(page);
  await page.goto("/panel");
  await expect(page).toHaveURL(/\/bienvenida$/, { timeout: 20_000 });
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByLabel("Nombre").fill("Negocio de ejemplo");
  await page.getByRole("button", { name: "Ir a mi panel" }).click();
  await expect(page).toHaveURL(/\/bienvenida$/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Tu negocio" })).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "todavía no está disponible" })).toHaveText(RECHAZO);
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem("payvro.alta"))).toBeNull();
});

test("omitir tambien llega al panel y no vuelve a pedir el alta", async ({ page }) => {
  await page.goto("/panel");
  await expect(page).toHaveURL(/\/bienvenida$/, { timeout: 20_000 });
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("heading", { name: "Elige tu giro" })).toBeVisible();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("heading", { name: "Tu negocio" })).toBeVisible();
  await expect(page.getByText("Omitir no guarda el perfil en el servidor.")).toBeVisible();
  await page.getByRole("button", { name: "Omitir" }).click();
  await expect(page).toHaveURL(/\/panel$/);
  await expect(visible(page, "Mi negocio")).toBeVisible();
  await page.goto("/panel");
  await expect(page).toHaveURL(/\/panel$/);
  await expect(page.getByRole("heading", { name: "Inicio" })).toBeVisible();
});

test("el teclado recorre el alta, omite y abre nuevo cobro", async ({ page }) => {
  await page.goto("/panel");
  await expect(page).toHaveURL(/\/bienvenida$/, { timeout: 20_000 });
  await page.getByRole("button", { name: "Continuar" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Elige tu giro" })).toBeVisible();
  await page.getByRole("button", { name: "Continuar" }).focus();
  await page.keyboard.press("Enter");
  await page.getByLabel("Nombre").focus();
  await page.keyboard.type("Negocio de ejemplo");
  await page.getByRole("button", { name: "Omitir" }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/panel$/);
  await page.getByRole("complementary").getByRole("link", { name: "Nuevo cobro", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/panel\/nuevo$/);
});

test("con nombre, /panel no redirige y muestra inicio, grafica, tarjetas y DEMO", async ({ page }) => {
  await entrarAlPanel(page);
  await expect(page).toHaveURL(/\/panel$/);
  await expect(page.getByRole("heading", { name: "Inicio" })).toBeVisible();
  await expect(enlaceVisible(page, "Inicio")).toHaveAttribute("aria-current", "page");
  await expect(enlaceVisible(page, "Cobros")).toBeVisible();
  await expect(enlaceVisible(page, "Ajustes")).toBeVisible();
  await expect(page.getByText("Cobrado hoy")).toBeVisible();
  await expect(page.getByText("Por liberar")).toBeVisible();
  await expect(page.getByText("En revisión").first()).toBeVisible();
  await expect(page.getByText("Modo DEMO: estos cobros son de práctica y no se mueve dinero real.")).toBeVisible();
  await expect(page.getByText("DEMO", { exact: true }).first()).toBeVisible();

  const grafica = page.getByRole("region", { name: "Cobros liberados por día de creación" });
  await expect(grafica).toBeVisible();
  await expect(grafica).toContainText("Suma por día de creación:");

  for (const entrada of NUBE) {
    await expect(page.getByRole("link", { name: entrada, exact: true })).toHaveCount(0);
  }
});

test("bienvenida y panel no hacen scroll horizontal a 375 y 1280", async ({ page }) => {
  const carpeta = path.join(process.cwd(), ".review", "os14b-capturas");
  fs.mkdirSync(carpeta, { recursive: true });

  for (const ancho of [375, 1280] as const) {
    await page.setViewportSize({ width: ancho, height: 900 });
    await recorrerAlta(page, carpeta, ancho);
  }
});

test("completar los 3 pasos persiste el nombre que devolvió Convex", async ({ page }) => {
  const enviados: string[] = [];
  page.on("websocket", (socket) => {
    socket.on("framesent", (frame) => enviados.push(textoDe(frame.payload)));
  });
  await page.goto("/panel");
  await expect(page).toHaveURL(/\/bienvenida$/, { timeout: 20_000 });
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("radio", { name: "Vendo por WhatsApp/Instagram" })).toBeChecked();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByLabel("Nombre").fill("Negocio de ejemplo");
  await expect(page.getByRole("region", { name: "Vista previa del pago" })).toContainText("Negocio de ejemplo");
  await page.getByRole("button", { name: "Ir a mi panel" }).click();
  await expect(page).toHaveURL(/\/panel$/);
  await expect.poll(() => enviados.join("\n")).toContain("negocio:actualizarPerfil");
  await expect(visible(page, "Negocio de ejemplo")).toBeVisible();
  await page.evaluate(() => sessionStorage.clear());
  await page.reload();
  await expect(page).toHaveURL(/\/panel$/);
  await expect(visible(page, "Negocio de ejemplo")).toBeVisible();
});
});

async function rechazarGuardado(page: Page): Promise<void> {
  await page.routeWebSocket(/\/sync/, (socket) => {
    const servidor = socket.connectToServer();
    socket.onMessage((mensaje) => {
      const texto = textoJson(mensaje);
      if (texto && esGuardarPerfil(texto)) {
        socket.send(rechazoDe(texto));
        return;
      }
      servidor.send(mensaje);
    });
    servidor.onMessage((mensaje) => socket.send(mensaje));
  });
}

function esGuardarPerfil(texto: string): boolean {
  const data = objeto(texto);
  return data?.type === "Mutation" && data.udfPath === "negocio:actualizarPerfil";
}

function rechazoDe(texto: string): string {
  const data = objeto(texto);
  return JSON.stringify({
    type: "MutationResponse",
    requestId: data?.requestId,
    success: false,
    result: RECHAZO,
    errorData: { codigo: "NO_IMPLEMENTADO", mensaje: RECHAZO },
    logLines: [],
  });
}

function visible(page: Page, texto: string) {
  return page.getByText(texto, { exact: true }).filter({ visible: true }).first();
}

function enlaceVisible(page: Page, nombre: string) {
  return page.getByRole("link", { name: nombre, exact: true }).filter({ visible: true });
}

async function recorrerAlta(page: Page, carpeta: string, ancho: number): Promise<void> {
  await page.goto("/panel");
  await page.evaluate(() => sessionStorage.removeItem("payvro.alta"));
  await page.reload();
  await expect(page).toHaveURL(/\/bienvenida$/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Cuenta" })).toBeVisible();
  await expect.poll(() => anchoDeScroll(page)).toBeLessThanOrEqual(ancho + 1);
  await page.screenshot({ path: path.join(carpeta, `bienvenida-cuenta-${ancho}.png`), fullPage: true });
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("heading", { name: "Elige tu giro" })).toBeVisible();
  await page.screenshot({ path: path.join(carpeta, `bienvenida-giro-${ancho}.png`), fullPage: true });
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("heading", { name: "Tu negocio" })).toBeVisible();
  await page.screenshot({ path: path.join(carpeta, `bienvenida-negocio-${ancho}.png`), fullPage: true });
  await page.getByRole("button", { name: "Omitir" }).click();
  await expect(page).toHaveURL(/\/panel$/);
  await expect(page.getByRole("heading", { name: "Inicio" })).toBeVisible();
  await expect.poll(() => anchoDeScroll(page)).toBeLessThanOrEqual(ancho + 1);
  await page.screenshot({ path: path.join(carpeta, `panel-${ancho}.png`), fullPage: true });
}

async function anchoDeScroll(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth);
}

function textoDe(payload: string | Buffer): string {
  return typeof payload === "string" ? payload : payload.toString("utf8");
}

function textoJson(mensaje: string | Buffer): string | null {
  const texto = textoDe(mensaje);
  return texto.startsWith("{") ? texto : null;
}

function objeto(texto: string): Record<string, unknown> | null {
  try {
    const data: unknown = JSON.parse(texto);
    return typeof data === "object" && data !== null && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : null;
  } catch (fallo: unknown) {
    if (fallo instanceof SyntaxError) {
      return null;
    }
    throw fallo;
  }
}
