import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { COBROS_DEMO } from "../lib/demo-fixtures";
import { formatoMXN } from "../lib/formato";

const NUBE = ["Plantillas", "Mostrador", "Plan", "Agente"] as const;

test("negocio sin nombre redirige /panel a /bienvenida", async ({ page }) => {
  await dejarAltaPendiente(page);
  await expect(page).toHaveURL(/\/bienvenida$/);
  await expect(page.getByRole("heading", { name: "Cuenta" })).toBeVisible();
});

test("completar los 3 pasos deja el nombre en el shell", async ({ page }) => {
  await dejarAltaPendiente(page);
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("radio", { name: "Vendo por WhatsApp/Instagram" })).toBeChecked();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByLabel("Nombre").fill("Negocio de ejemplo");
  await expect(page.getByRole("region", { name: "Vista previa del pago" })).toContainText("Negocio de ejemplo");
  await page.getByRole("button", { name: "Ir a mi panel" }).click();
  await expect(page).toHaveURL(/\/panel$/);
  await expect(page.getByText("Negocio de ejemplo")).toBeVisible();
});

test("omitir tambien llega al panel y no vuelve a pedir el alta", async ({ page }) => {
  await dejarAltaPendiente(page);
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("heading", { name: "Elige tu giro" })).toBeVisible();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("heading", { name: "Tu negocio" })).toBeVisible();
  await page.getByRole("button", { name: "Omitir" }).click();
  await expect(page).toHaveURL(/\/panel$/);
  await expect(page.getByText("Mi negocio")).toBeVisible();
  await page.goto("/panel");
  await expect(page).toHaveURL(/\/panel$/);
  await expect(page.getByRole("heading", { name: "Inicio" })).toBeVisible();
});

test("con nombre, /panel no redirige y muestra inicio, grafica, tarjetas y DEMO", async ({ page }) => {
  await page.goto("/panel");
  await expect(page).toHaveURL(/\/panel$/);
  await expect(page.getByRole("heading", { name: "Inicio" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Inicio" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByText("Cobrado hoy")).toBeVisible();
  await expect(page.getByText("Por liberar")).toBeVisible();
  await expect(page.getByText("En revisión").first()).toBeVisible();
  await expect(page.getByText("Modo DEMO: estos cobros son de práctica y no se mueve dinero real.")).toBeVisible();

  const grafica = page.getByRole("region", { name: "Ingresos de los últimos 7 días" });
  await expect(grafica).toBeVisible();
  const total = totalSemanaCentavos(new Date());
  if (total === 0) {
    await expect(grafica.getByText("Tus ingresos aparecerán aquí cuando cobres el primero.")).toBeVisible();
  } else {
    await expect(grafica).toContainText(`Total de la semana: ${formatoMXN(total)}`);
    await expect(grafica.locator("svg").first()).toBeVisible();
  }

  for (const entrada of NUBE) {
    await expect(page.getByRole("link", { name: entrada, exact: true })).toHaveCount(0);
  }
});

test("el teclado completa el alta y abre nuevo cobro", async ({ page }) => {
  await dejarAltaPendiente(page);
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
  await page.getByRole("link", { name: "Nuevo cobro" }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/panel\/nuevo$/);
});

test("bienvenida y panel no hacen scroll horizontal a 375 y 1280", async ({ page }) => {
  const carpeta = path.join(process.cwd(), ".review", "os14-capturas");
  fs.mkdirSync(carpeta, { recursive: true });

  for (const ancho of [375, 1280] as const) {
    await page.setViewportSize({ width: ancho, height: 900 });
    await page.goto("/panel");
    await page.evaluate(() => sessionStorage.setItem("payvro.alta", "pendiente"));
    await page.goto("/bienvenida");
    await expect(page.getByRole("heading", { name: "Cuenta" })).toBeVisible();
    await expect.poll(() => anchoDeScroll(page)).toBeLessThanOrEqual(ancho + 1);
    await page.screenshot({ path: path.join(carpeta, `bienvenida-cuenta-${ancho}.png`), fullPage: true });

    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByRole("heading", { name: "Elige tu giro" })).toBeVisible();
    await expect.poll(() => anchoDeScroll(page)).toBeLessThanOrEqual(ancho + 1);
    await page.screenshot({ path: path.join(carpeta, `bienvenida-giro-${ancho}.png`), fullPage: true });

    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByRole("heading", { name: "Tu negocio" })).toBeVisible();
    await expect.poll(() => anchoDeScroll(page)).toBeLessThanOrEqual(ancho + 1);
    await page.screenshot({ path: path.join(carpeta, `bienvenida-negocio-${ancho}.png`), fullPage: true });

    await page.getByRole("button", { name: "Omitir" }).click();
    await expect(page).toHaveURL(/\/panel$/);
    await expect(page.getByRole("heading", { name: "Inicio" })).toBeVisible();
    await expect.poll(() => anchoDeScroll(page)).toBeLessThanOrEqual(ancho + 1);
    await page.screenshot({ path: path.join(carpeta, `panel-${ancho}.png`), fullPage: true });
  }
});

async function dejarAltaPendiente(page: Page): Promise<void> {
  await page.goto("/panel");
  await page.evaluate(() => sessionStorage.setItem("payvro.alta", "pendiente"));
  await page.reload();
}

async function anchoDeScroll(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth);
}

function totalSemanaCentavos(ahora: Date): number {
  const claves = clavesVentana(ahora);
  let total = 0;
  for (const cobro of COBROS_DEMO) {
    if (cobro.estado !== "pagado_verificado" && cobro.estado !== "liberado") {
      continue;
    }
    if (!claves.has(claveMexico(cobro.creadoEn))) {
      continue;
    }
    total += cobro.montoCentavos;
  }
  return total;
}

function clavesVentana(ahora: Date): Set<string> {
  const [anio, mes, dia] = claveMexico(ahora.getTime()).split("-").map((parte) => Number(parte));
  const claves = new Set<string>();
  for (let delta = -6; delta <= 0; delta += 1) {
    const corrido = new Date(Date.UTC(anio ?? 0, (mes ?? 1) - 1, (dia ?? 1) + delta));
    const y = String(corrido.getUTCFullYear()).padStart(4, "0");
    const m = String(corrido.getUTCMonth() + 1).padStart(2, "0");
    const d = String(corrido.getUTCDate()).padStart(2, "0");
    claves.add(`${y}-${m}-${d}`);
  }
  return claves;
}

function claveMexico(ms: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
}
