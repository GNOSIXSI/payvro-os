import { expect, test } from "@playwright/test";

test("home presents PAYVRO and the DEMO mode", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("img", { name: "PAYVRO" })).toBeVisible();
  await expect(page.getByText("Cobra y libera, sin comprobantes.")).toBeVisible();
  await expect(page.getByText("DEMO", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ir al panel" })).toHaveAttribute("href", "/panel");
});
