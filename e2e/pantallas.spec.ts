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

test("/panel shows the three tiles and a row per fixture state", async ({ page }) => {
  await page.goto("/panel");

  await expect(page.getByText("Cobrado hoy")).toBeVisible();
  await expect(page.getByText("Por liberar")).toBeVisible();
  await expect(page.getByText("En revisión").first()).toBeVisible();
  await expect(page.getByText("DEMO", { exact: true })).toBeVisible();

  const tabla = page.getByRole("table");
  await expect(tabla.getByText("Esperando pago", { exact: true })).toBeVisible();
  await expect(tabla.getByText("Pago verificado", { exact: true })).toBeVisible();
  await expect(tabla.getByText("Liberado", { exact: true })).toBeVisible();
  await expect(tabla.getByText("En revisión", { exact: true })).toBeVisible();
  await expect(tabla.getByText("Borrador", { exact: true })).toHaveCount(0);
  await expect(tabla.getByText("Expirado", { exact: true })).toHaveCount(0);
  await expect(tabla.getByText("Cancelado", { exact: true })).toHaveCount(0);
});

test("/pagar fixture shows the business, the amount and waiting copy", async ({ page }) => {
  await page.goto(`/pagar/${COBRO_ESPERA}`);

  await expect(page.getByRole("heading", { name: "Dulces Ana — Ejemplo" })).toBeVisible();
  await expect(page.getByText("$149.00")).toBeVisible();
  await expect(page.getByText("Esperando pago", { exact: true })).toBeVisible();
  await expect(page.getByText("DEMO", { exact: true })).toBeVisible();
});

test("/pagar/cob_noexiste shows the not-available message", async ({ page }) => {
  await page.goto("/pagar/cob_noexiste");

  await expect(page.getByText("Este cobro no existe o ya no está disponible.")).toBeVisible();
});

test("payer page does not mention CLABE, keys or api key", async ({ page }) => {
  await page.goto(`/pagar/${COBRO_ESPERA}`);

  await expect(page.getByText(/CLABE|llave|api key/i)).toHaveCount(0);
});

test("keyboard can open nuevo cobro and sees the payer link is unavailable", async ({ page }) => {
  await page.goto("/panel/nuevo");
  await page.getByLabel("Concepto").fill("Pedido de prueba");
  await page.getByLabel("Monto").fill("0.01");
  await page.getByRole("button", { name: "Crear cobro" }).press("Enter");
  await expect(page.getByText("La creación de cobros todavía no está disponible.")).toBeVisible();

  await page.goto(`/panel/cobros/${COBRO_ESPERA}`);
  await expect(page.getByRole("button", { name: "Mostrar QR" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copiar link" })).toBeDisabled();
  await expect(page.getByText("El link de pago aún no está disponible")).toBeVisible();
});

test("panel and alta call the Convex stubs", async ({ page }) => {
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
  await expect(page.getByText("La creación de cobros todavía no está disponible.")).toBeVisible();
  await expect.poll(() => enviados.join("\n")).toContain("cobros:crear");
  await expect.poll(() => recibidos.join("\n")).toContain("NO_IMPLEMENTADO");
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
