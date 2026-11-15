import { expect, test, type Page } from "@playwright/test";
import { entrarAlPanel } from "./entrar-panel";

test("de /panel a Liberado contra el motor, en DEMO", async ({ page, context }) => {
  test.setTimeout(90_000);
  await context.grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: "http://127.0.0.1:3105",
  });

  await entrarAlPanel(page);
  await expect(demo(page)).toBeVisible();
  await page.getByRole("link", { name: "Nuevo cobro", exact: true }).filter({ visible: true }).first().click();
  await expect(page).toHaveURL(/\/panel\/nuevo$/);
  await expect(demo(page)).toBeVisible();

  await page.getByLabel("Concepto").fill("Pedido de prueba");
  await page.getByLabel("Monto").fill("450");
  await page.getByRole("button", { name: "Crear cobro" }).click();
  await expect(page).toHaveURL(/\/panel\/cobros\/cob_/, { timeout: 20_000 });
  const publicId = publicIdDe(page.url());
  const folio = (await page.getByText(/^#\d+$/).textContent())?.trim() ?? "";
  await expect(page.getByText("Esperando pago", { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(demo(page)).toBeVisible();

  await page.getByRole("button", { name: "Copiar link" }).click();
  await expect(page.getByRole("button", { name: "Copiado" })).toBeVisible();
  const enlace = await page.evaluate(() => navigator.clipboard.readText());
  expect(enlace).toBe(`http://127.0.0.1:3105/pagar/${publicId}`);

  const pagador = await context.newPage();
  const enviados: string[] = [];
  pagador.on("websocket", (socket) => {
    socket.on("framesent", (frame) => enviados.push(textoDeFrame(frame.payload)));
  });
  await pagador.goto(enlace);
  await expect(pagador.getByText("$450.00")).toBeVisible();
  await expect(pagador.getByText("Esperando pago", { exact: true })).toBeVisible();
  await expect(demo(pagador)).toBeVisible();
  await expect.poll(() => enviados.join("\n")).toContain("publico:vigilar");

  await pagador.getByRole("button", { name: "Simular pago" }).click();
  await expect(pagador.getByText("Pago verificado", { exact: true })).toBeVisible({ timeout: 20_000 });

  await expect(page.getByText("Liberado", { exact: true }).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Cobro creado", { exact: true })).toBeVisible();
  await expect(page.getByText("Pago verificado", { exact: true })).toBeVisible();
  await expect(page.getByText("Pendiente", { exact: true })).toHaveCount(0);

  await page.goto("/panel");
  const fila = page.getByRole("row").filter({
    has: page.locator(`a[href="/panel/cobros/${publicId}"]`),
  });
  await expect(fila).toContainText("Liberado");
  await expect(fila.getByRole("link", { name: folio ?? "", exact: true })).toBeVisible();
  await expect(demo(page)).toBeVisible();
});

function publicIdDe(url: string): string {
  const id = new URL(url).pathname.split("/").pop() ?? "";
  if (!/^cob_[0-9A-HJKMNP-TV-Z]{26}$/.test(id)) {
    throw new Error("el cobro creado no trae publicId");
  }
  return id;
}

function demo(page: Page) {
  return page.getByText("DEMO", { exact: true }).first();
}

function textoDeFrame(payload: string | Buffer): string {
  return typeof payload === "string" ? payload : payload.toString("utf8");
}
