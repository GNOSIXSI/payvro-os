import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { recordarConsulta, vaciarNombreNegocio } from "./rewriter-nombre";

const NUBE = ["Plantillas", "Mostrador", "Plan", "Agente"] as const;

test("negocio sin nombre redirige /panel a /bienvenida", async ({ page }) => {
  await negocioSinNombre(page);
  await page.goto("/panel");
  await expect(page).toHaveURL(/\/bienvenida$/);
  await expect(page.getByRole("heading", { name: "Cuenta" })).toBeVisible();
});

test("completar los 3 pasos deja el nombre en el shell", async ({ page }) => {
  await negocioSinNombre(page);
  await page.goto("/panel");
  await expect(page).toHaveURL(/\/bienvenida$/);
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("radio", { name: "Vendo por WhatsApp/Instagram" })).toBeChecked();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByLabel("Nombre").fill("Negocio de ejemplo");
  await expect(page.getByRole("region", { name: "Vista previa del pago" })).toContainText("Negocio de ejemplo");
  await page.getByRole("button", { name: "Ir a mi panel" }).click();
  await expect(page).toHaveURL(/\/panel$/);
  await expect(visible(page, "Negocio de ejemplo")).toBeVisible();
});

test("omitir tambien llega al panel y no vuelve a pedir el alta", async ({ page }) => {
  await negocioSinNombre(page);
  await page.goto("/panel");
  await expect(page).toHaveURL(/\/bienvenida$/);
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("heading", { name: "Elige tu giro" })).toBeVisible();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("heading", { name: "Tu negocio" })).toBeVisible();
  await page.getByRole("button", { name: "Omitir" }).click();
  await expect(page).toHaveURL(/\/panel$/);
  await expect(visible(page, "Mi negocio")).toBeVisible();
  await page.goto("/panel");
  await expect(page).toHaveURL(/\/panel$/);
  await expect(page.getByRole("heading", { name: "Inicio" })).toBeVisible();
});

test("con nombre, /panel no redirige y muestra inicio, grafica, tarjetas y DEMO", async ({ page }) => {
  await page.goto("/panel");
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

  const grafica = page.getByRole("region", { name: "Ingresos de los últimos 7 días" });
  await expect(grafica).toBeVisible();
  await expect(grafica).toContainText("Total de la semana:");

  for (const entrada of NUBE) {
    await expect(page.getByRole("link", { name: entrada, exact: true })).toHaveCount(0);
  }
});

test("el teclado completa el alta y abre nuevo cobro", async ({ page }) => {
  await negocioSinNombre(page);
  await page.goto("/panel");
  await expect(page).toHaveURL(/\/bienvenida$/);
  await page.getByRole("button", { name: "Continuar" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Elige tu giro" })).toBeVisible();
  await page.getByRole("button", { name: "Continuar" }).focus();
  await page.keyboard.press("Enter");
  await page.getByLabel("Nombre").focus();
  await page.keyboard.type("Negocio de ejemplo");
  await page.getByRole("button", { name: "Ir a mi panel" }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/panel$/);
  await enlaceVisible(page, "Nuevo cobro").focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/panel\/nuevo$/);
});

test("bienvenida y panel no hacen scroll horizontal a 375 y 1280", async ({ page }) => {
  const carpeta = path.join(process.cwd(), ".review", "os14b-capturas");
  fs.mkdirSync(carpeta, { recursive: true });
  await negocioSinNombre(page);

  for (const ancho of [375, 1280] as const) {
    await page.setViewportSize({ width: ancho, height: 900 });
    await recorrerAlta(page, carpeta, ancho);
  }
});

async function negocioSinNombre(page: Page): Promise<void> {
  const ids = new Set<number>();
  await page.routeWebSocket(/.*/, (socket) => {
    const servidor = socket.connectToServer();
    socket.onMessage((mensaje) => {
      const texto = textoJson(mensaje);
      if (texto) {
        recordarConsulta(ids, texto);
      }
      servidor.send(mensaje);
    });
    servidor.onMessage((mensaje) => {
      const texto = textoJson(mensaje);
      socket.send(texto ? vaciarNombreNegocio(ids, texto) : mensaje);
    });
  });
}

function textoJson(mensaje: string | Buffer): string | null {
  const texto = typeof mensaje === "string" ? mensaje : mensaje.toString("utf8");
  return texto.startsWith("{") ? texto : null;
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
  await expect(page).toHaveURL(/\/bienvenida$/);
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
