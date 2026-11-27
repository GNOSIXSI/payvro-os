import { expect, test, type Browser } from "@playwright/test";
import { spawn } from "node:child_process";
import { generateKeyPairSync, sign } from "node:crypto";
import { cp, glob, mkdtemp, rm, symlink } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { once } from "node:events";
import { convexTest } from "convex-test";
import { anyApi, makeFunctionReference } from "convex/server";
import { convexToJson, ConvexError } from "convex/values";
import { createServer as createViteServer } from "vite";
import type schema from "../convex/schema";

const issuer = "https://clerk.example.invalid";
const correo = "dueno@example.invalid";
const identidades = new Map([
  ["permitido", { email: correo, emailVerified: true }],
  ["ajeno", { email: "visitante@example.invalid", emailVerified: true }],
  ["no-verificado", { email: correo, emailVerified: false }],
]);

async function probarHidratacion(browser: Browser, baseURL: string) {
  const context = await browser.newContext({ baseURL, javaScriptEnabled: true });
  try {
    // Use the real, pinned browser SDK. Only the tenant's API is simulated.
    await context.route("**/*", async (route) => {
      const { origin, pathname } = new URL(route.request().url());
      if (origin === baseURL) return route.continue();
      if (origin !== issuer) return route.abort();
      const headers = { "access-control-allow-origin": baseURL, "access-control-allow-credentials": "true" };
      const asset = pathname.match(/^\/npm\/@clerk\/(clerk-js|ui)@[^/]+\/dist\/([\w.-]+\.js)$/);
      if (asset) {
        const version = asset[1] === "clerk-js" ? "6.43.1" : "1.42.6";
        const archivo = await fetch(`https://cdn.jsdelivr.net/npm/@clerk/${asset[1]}@${version}/dist/${asset[2]}`, {
          signal: AbortSignal.timeout(15_000),
        });
        if (!archivo.ok) throw new Error(`Clerk browser asset: ${asset[2]} (${archivo.status})`);
        return route.fulfill({ headers, contentType: "text/javascript", body: Buffer.from(await archivo.arrayBuffer()) });
      }
      if (pathname === "/v1/environment") {
        return route.fulfill({ headers, json: {
          object: "environment",
          auth_config: { single_session_mode: true },
          display_config: { application_name: "PAYVRO Ejemplo", instance_environment_type: "production", branded: false },
          user_settings: { attributes: {
            email_address: { enabled: true, required: true, used_for_first_factor: true, first_factors: ["email_code"], verifications: ["email_code"] },
          } },
        } });
      }
      if (pathname === "/v1/client") {
        return route.fulfill({ headers, json: { response: { object: "client", id: "client_fixture", sessions: [] } } });
      }
      return route.abort();
    });
    const page = await context.newPage();
    await page.goto("/panel/nuevo");
    await expect(page).toHaveURL(/\/entrar(?:\?|$)/);
    const campoCorreo = page.getByRole("textbox", { name: /email address|correo electrónico/i });
    await expect(campoCorreo).toBeEditable({ timeout: 30_000 });
    await campoCorreo.fill("visitante@example.invalid");
    await expect(campoCorreo).toHaveValue("visitante@example.invalid");
    await expect(page.getByRole("button", { name: "Crear cobro" })).toHaveCount(0);
  } finally {
    await context.close();
  }
}

test("la sesión Clerk abre el panel solo si Convex autoriza al dueño; el pagador no inicia sesión", async ({ browser }) => {
  test.setTimeout(120_000);
  const raiz = resolve(import.meta.dirname, "..");
  const temporal = await mkdtemp(join(tmpdir(), "payvro-dueno-"));
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwt = (claims: Record<string, unknown>, categoria: "sesion" | "plantilla") => {
    const base64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
    const now = Math.floor(Date.now() / 1000);
    const contenido = `${base64({ alg: "RS256", typ: "JWT", kid: "fixture", cat: categoria === "sesion" ? "cl_B7d4PD111AAA" : "cl_B7d4PD222AAA" })}.${base64({ iss: issuer, iat: now, nbf: now - 1, exp: now + 90, ...claims })}`;
    return `${contenido}.${sign("RSA-SHA256", Buffer.from(contenido), privateKey).toString("base64url")}`;
  };
  const tokens = new Map([...identidades.keys()].map((id) => [id, jwt({ sub: id, aud: "convex" }, "plantilla")]));
  const vite = await createViteServer({ root: raiz, configFile: false, server: { middlewareMode: true, ws: false, watch: null } });
  const modulos: Record<string, () => Promise<unknown>> = {};
  for await (const archivo of glob("convex/**/*.ts", { cwd: raiz })) modulos[archivo] = () => vite.ssrLoadModule(`/${archivo}`);
  const entorno = { PAYVRO_MODE: process.env.PAYVRO_MODE, PAYVRO_OWNER_EMAILS: process.env.PAYVRO_OWNER_EMAILS };
  process.env.PAYVRO_MODE = "live";
  process.env.PAYVRO_OWNER_EMAILS = correo;
  const esquema = await vite.ssrLoadModule("/convex/schema.ts") as { default: typeof schema };
  const backend = convexTest(esquema.default, modulos);
  const consultas: string[] = [];
  const solicitudes: string[] = [];
  const proveedor = createServer(async (req, res) => {
    solicitudes.push(`${req.method} ${req.url?.split("?")[0]}`);
    const enviar = (value: unknown) => res.setHeader("Content-Type", "application/json").end(JSON.stringify(value));
    if (req.url === "/v1/jwks" && req.method === "GET") {
      return enviar({ keys: [{ ...publicKey.export({ format: "jwk" }), kid: "fixture", alg: "RS256", use: "sig" }] });
    }
    const sesion = req.url?.match(/^\/v1\/sessions\/ses_(.+)\/tokens\/convex$/)?.[1];
    if (req.method === "POST" && sesion && tokens.has(sesion)) {
      return enviar({ object: "token", jwt: tokens.get(sesion) });
    }
    if (req.url === "/api/query" && req.method === "POST") {
      const bloques: Buffer[] = [];
      for await (const bloque of req) bloques.push(bloque);
      const { path, args } = JSON.parse(Buffer.concat(bloques).toString());
      consultas.push(path);
      if (path !== "publico:instalacion" && path !== "negocio:obtener") return res.writeHead(404).end();
      const id = [...tokens].find(([, token]) => req.headers.authorization === `Bearer ${token}`)?.[0];
      if (req.headers.authorization && !id) return res.writeHead(401).end();
      const cliente = id ? backend.withIdentity({ subject: id, ...identidades.get(id) }) : backend;
      try {
        const value = await cliente.query(makeFunctionReference<"query">(path), args[0]);
        return enviar({ status: "success", value: convexToJson(value) });
      } catch (error) {
        if (!(error instanceof ConvexError)) return res.writeHead(500).end();
        return enviar({ status: "error", errorMessage: "Consulta rechazada", errorData: convexToJson(error.data) });
      }
    }
    res.writeHead(404).end();
  });
  proveedor.listen(0, "127.0.0.1");
  await once(proveedor, "listening");
  const direccion = proveedor.address();
  if (!direccion || typeof direccion === "string") throw new Error("Proveedor de prueba sin puerto TCP");
  const loopback = `http://127.0.0.1:${direccion.port}`;
  let next: ReturnType<typeof spawn> | undefined;
  let errores = "";
  try {
    await backend.mutation(anyApi.instalacion.instalarLive, { nombre: "Negocio de ejemplo", giro: "social", colorMarca: "#076B76" });
    for (const archivo of ["app", "components", "convex", "lib", "public", "next.config.ts", "package.json", "package-lock.json", "postcss.config.mjs", "tsconfig.json", "proxy.ts"]) {
      await cp(join(raiz, archivo), join(temporal, archivo), { recursive: true, force: false }).catch((fallo: NodeJS.ErrnoException) => {
        if (archivo !== "proxy.ts" || fallo.code !== "ENOENT") throw fallo;
      });
    }
    await symlink(join(raiz, "node_modules"), join(temporal, "node_modules"), "dir");
    // Do not inherit any configuration/credentials from this machine or the DEMO server.
    next = spawn(process.execPath, [join(temporal, "node_modules/next/dist/bin/next"), "dev", "--webpack", "--hostname", "localhost", "--port", "0"], {
      cwd: temporal, env: {
        PATH: process.env.PATH, HOME: temporal, NODE_ENV: "development", NEXT_TELEMETRY_DISABLED: "1",
        NODE_OPTIONS: "--dns-result-order=ipv4first",
        NEXT_PUBLIC_CONVEX_URL: loopback,
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: ["pk", "live", Buffer.from("clerk.example.invalid$").toString("base64url")].join("_"),
        CLERK_SECRET_KEY: ["sk", "live", Buffer.from("fixture-no-provider").toString("hex")].join("_"),
        CLERK_API_URL: loopback,
      },
    });
    const baseURL = await new Promise<string>((ok, fail) => {
      let texto = "";
      next!.stdout!.on("data", (data) => {
        texto = (texto + String(data)).slice(-4000);
        const url = texto.match(/Local:\s+(http:\/\/localhost:\d+)/)?.[1];
        if (url && texto.includes("Ready")) ok(url);
      });
      next!.stdout!.on("data", (data) => { errores = (errores + String(data)).slice(-4000); });
      next!.once("error", fail);
      next!.once("exit", (code) => fail(new Error(`Next terminó antes de servir (exit=${code})`)));
      next!.stderr!.on("data", (data) => { errores = (errores + String(data)).slice(-4000); });
    });
    await test.step("Clerk hidrata el formulario en /entrar después de la redirección, con JavaScript", () => probarHidratacion(browser, baseURL));
    const context = await browser.newContext({ baseURL, javaScriptEnabled: false });
    try {
      await context.route("**/*", (route) => route.request().url().startsWith(`${baseURL}/`) ? route.continue() : route.abort());
      const page = await context.newPage();
      await page.goto("/panel/nuevo");
      await expect(page).toHaveURL(/\/entrar(?:\?|$)/);
      await expect(page.getByRole("heading", { name: "Entrar al panel" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Crear cobro" })).toHaveCount(0);
      const antesDelPagador = consultas.length;
      await page.goto(`/pagar/cob_${"0".repeat(25)}1`);
      await expect(page).toHaveURL(/\/pagar\//);
      expect(consultas).toHaveLength(antesDelPagador);
      for (const id of identidades.keys()) {
        await context.addCookies([
          { name: "__client_uat", url: baseURL, value: String(Math.floor(Date.now() / 1000) - 10) },
          { name: "__session", url: baseURL, value: jwt({ sid: `ses_${id}`, sub: id, azp: baseURL, sts: "active" }, "sesion") },
        ]);
        await page.goto("/panel/nuevo");
        if (id === "permitido") {
          await expect(page.getByRole("button", { name: "Crear cobro" })).toBeVisible();
        } else {
          await expect(page.getByText("No tienes permiso para operar este negocio.")).toBeVisible();
          await expect(page.getByRole("button", { name: "Crear cobro" })).toHaveCount(0);
        }
      }
      expect(consultas.filter((path) => path === "negocio:obtener")).toHaveLength(3);
    } finally {
      await context.close();
    }
  } catch (error) {
    // Surface only framework errors; never print Clerk request headers or tokens.
    console.error(errores.replace(/eyJ[\w.-]+/g, "[JWT]"), solicitudes);
    throw error;
  } finally {
    if (next && next.exitCode === null && next.signalCode === null) {
      const salido = once(next, "exit");
      next.kill("SIGTERM");
      await salido;
    }
    proveedor.closeAllConnections();
    await new Promise<void>((ok) => proveedor.close(() => ok()));
    await vite.close();
    for (const [clave, valor] of Object.entries(entorno)) {
      if (valor === undefined) delete process.env[clave];
      else process.env[clave] = valor;
    }
    await rm(temporal, { recursive: true, force: true });
  }
});
