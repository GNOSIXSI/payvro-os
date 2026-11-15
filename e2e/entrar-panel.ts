import { expect, type Page } from "@playwright/test";

export async function entrarAlPanel(page: Page): Promise<void> {
  await page.goto("/panel");
  const alta = await page.waitForURL(/\/bienvenida$/, { timeout: 20_000 }).then(
    () => true,
    () => false,
  );
  if (alta) {
    await omitirAlta(page);
  }
  await expect(page).toHaveURL(/\/panel$/);
  await expect(page.getByRole("heading", { name: "Inicio" })).toBeVisible();
}

async function omitirAlta(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Omitir" }).click();
}
