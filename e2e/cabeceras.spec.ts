import { expect, test } from "@playwright/test";

const PUBLIC_ID = "cob_00000000000000000000000001";
const PAGAR = `/pagar/${PUBLIC_ID}`;

for (const ruta of ["/", "/panel", "/panel/nuevo", `/panel/cobros/${PUBLIC_ID}`, PAGAR]) {
  test(`entrega cabeceras de seguridad en ${ruta}`, async ({ page }) => {
    const respuesta = await page.goto(ruta, { waitUntil: "domcontentloaded" });
    expect(respuesta?.status()).toBe(200);
    const cabeceras = respuesta?.headers() ?? {};
    expect(cabeceras["x-content-type-options"]).toBe("nosniff");
    expect(cabeceras["x-frame-options"]).toBe("DENY");
    expect(cabeceras["permissions-policy"]).toBe("camera=(), microphone=(), geolocation=()");
    if (ruta !== "/") {
      expect(cabeceras["referrer-policy"]).toBe("no-referrer");
      expect(cabeceras["cache-control"]?.split(/\s*,\s*/)).toContain("no-store");
    }
  });
}

test("el pagador se hidrata y una navegación saliente no envía la capacidad", async ({ page }) => {
  const errores: string[] = [];
  const argsCobro: unknown[] = [];
  page.on("pageerror", (error) => errores.push(error.message));
  await page.routeWebSocket(/\/sync/, (socket) => {
    const version = (querySet: number) => ({ querySet, ts: btoa(String.fromCharCode(querySet, 0, 0, 0, 0, 0, 0, 0)), identity: 0 });
    let ultima = 0;
    socket.onMessage((raw) => {
      const mensaje = JSON.parse(raw.toString());
      if (mensaje.type !== "ModifyQuerySet") return;
      const modifications = [];
      for (const mod of mensaje.modifications) {
        if (mod.type !== "Add" || mod.udfPath !== "publico:cobro") continue;
        argsCobro.push(mod.args);
        modifications.push({ type: "QueryUpdated", queryId: mod.queryId, logLines: [], journal: null, value: {
          negocio: { nombre: "Negocio de ejemplo", colorMarca: "#076B76" }, folio: 7,
          concepto: "Pedido de prueba", montoCentavos: 4500, estadoVisible: "Esperando pago", modo: "demo",
          qrString: "QR de ejemplo",
        } });
      }
      socket.send(JSON.stringify({ type: "Transition", startVersion: version(ultima), endVersion: version(mensaje.newVersion), modifications }));
      ultima = mensaje.newVersion;
    });
  });
  await page.goto(PAGAR);
  await expect(page.getByText("Pedido de prueba", { exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: "Código QR CoDi" })).toBeVisible();
  expect(argsCobro).toContainEqual([{ publicId: PUBLIC_ID }]);
  expect(errores).toEqual([]);

  const destino = new URL("/pv04-referrer-fixture", page.url()).href;
  await page.route(destino, (route) => route.fulfill({ body: "Destino de prueba" }));
  await page.evaluate((href) => {
    const enlace = document.createElement("a");
    enlace.href = href;
    enlace.textContent = "Navegación de prueba";
    document.body.append(enlace);
  }, destino);
  const salida = page.waitForRequest(destino);
  await page.getByRole("link", { name: "Navegación de prueba" }).click();
  expect(await (await salida).headerValue("referer")).toBeNull();
  await expect(page.getByText("Destino de prueba", { exact: true })).toBeVisible();
});
