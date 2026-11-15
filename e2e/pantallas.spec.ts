import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const COBRO_ESPERA = "cob_00000000000000000000000000";
const RUTAS = [
  "/panel",
  "/panel/nuevo",
  `/panel/cobros/${COBRO_ESPERA}`,
  "/panel/ajustes",
  `/pagar/${COBRO_ESPERA}`,
] as const;

test("/panel shows the three tiles and DEMO", async ({ page }) => {
  await page.goto("/panel");

  await expect(page.getByText("Cobrado hoy")).toBeVisible();
  await expect(page.getByText("Por liberar")).toBeVisible();
  await expect(page.getByText("En revisión").first()).toBeVisible();
  await expect(page.getByText("DEMO", { exact: true })).toBeVisible();
  await expect(page.getByText("Borrador", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Expirado", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Cancelado", { exact: true })).toHaveCount(0);
});

test("/pagar unknown id shows the not-available message", async ({ page }) => {
  await page.goto(`/pagar/${COBRO_ESPERA}`);

  await expect(page.getByRole("heading", { name: "Este cobro no existe o ya no está disponible." })).toBeVisible();
});

test("/pagar/cob_noexiste shows the not-available message", async ({ page }) => {
  await page.goto("/pagar/cob_noexiste");

  await expect(page.getByText("Este cobro no existe o ya no está disponible.")).toBeVisible();
});

test("payer page does not mention CLABE, keys or api key", async ({ page }) => {
  await page.goto(`/pagar/${COBRO_ESPERA}`);

  await expect(page.getByText(/CLABE|llave|api key/i)).toHaveCount(0);
});

test("keyboard can create a cobro and the local payer link is available", async ({ page }) => {
  await page.goto("/panel/nuevo");
  await page.getByLabel("Concepto").fill("Pedido de prueba");
  await page.getByLabel("Monto").fill("0.01");
  await page.getByRole("button", { name: "Crear cobro" }).press("Enter");
  await expect(page).toHaveURL(/\/panel\/cobros\/cob_/, { timeout: 20_000 });
  await expect(page.getByText("Esperando pago", { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: "Copiar link" })).toBeEnabled();
});

test("panel and alta call the real cobro mutation", async ({ page }) => {
  const enviados: string[] = [];
  const recibidos: string[] = [];
  page.on("websocket", (socket) => {
    socket.on("framesent", (frame) => enviados.push(textoDeFrame(frame.payload)));
    socket.on("framereceived", (frame) => recibidos.push(textoDeFrame(frame.payload)));
  });

  await page.goto("/panel");
  await expect(page.getByText("Cobrado hoy")).toBeVisible();
  await expect.poll(() => enviados.join("\n")).toContain("cobros:listar");
  await expect.poll(() => enviados.join("\n")).toContain("cobros:resumenDelDia");

  await page.goto("/panel/nuevo");
  await page.getByLabel("Concepto").fill("Pedido de prueba");
  await page.getByLabel("Monto").fill("0.01");
  await page.getByRole("button", { name: "Crear cobro" }).click();
  await expect(page).toHaveURL(/\/panel\/cobros\/cob_/, { timeout: 20_000 });
  await expect.poll(() => enviados.join("\n")).toContain("cobros:crear");
  await expect.poll(() => recibidos.join("\n")).not.toContain("NO_IMPLEMENTADO");
});

test("screens do not scroll horizontally at 375 and 1280", async ({ page }) => {
  const carpeta = path.join(process.cwd(), ".review", "os04-capturas");
  fs.mkdirSync(carpeta, { recursive: true });

  for (const ancho of [375, 1280] as const) {
    await page.setViewportSize({ width: ancho, height: 900 });
    for (const ruta of RUTAS) {
      await page.goto(ruta);
      await expect(page.getByRole("heading").first()).toBeVisible();
      await expect.poll(() => anchoDeScroll(page)).toBeLessThanOrEqual(ancho + 1);
      const nombre = `${ruta.replaceAll("/", "_").replace(/^_/, "") || "raiz"}-${ancho}.png`;
      await page.screenshot({
        path: path.join(carpeta, nombre),
        fullPage: true,
      });
    }
  }
});

function textoDeFrame(payload: string | Buffer): string {
  return typeof payload === "string" ? payload : payload.toString("utf8");
}

async function anchoDeScroll(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth);
}
