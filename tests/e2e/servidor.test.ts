import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const envLocal = path.join(raiz, ".env.local");
const plantado = [
  "MARCA=no-tocar",
  "CONVEX_DEPLOYMENT=dev:shared-example",
  "NEXT_PUBLIC_CONVEX_URL=https://shared.example.convex.cloud",
  "",
].join("\n");

const heredado = {
  CONVEX_DEPLOYMENT: "dev:shared-example",
  CONVEX_URL: "https://shared.example.convex.cloud",
  NEXT_PUBLIC_CONVEX_URL: "https://shared.example.convex.cloud",
  CONVEX_DEPLOY_KEY: "key-shared-example",
  CONVEX_DEPLOYMENT_TOKEN: "token-shared-example",
  CONVEX_SELF_HOSTED_URL: "https://shared.example.convex.cloud",
  CONVEX_SELF_HOSTED_ADMIN_KEY: "admin-shared-example",
} as const;

describe("e2e/servidor.sh", () => {
  const temporales: string[] = [];
  let previo: Buffer | null = null;

  afterEach(() => {
    if (previo === null) fs.rmSync(envLocal, { force: true });
    else fs.writeFileSync(envLocal, previo);
    previo = null;
    for (const directorio of temporales.splice(0)) {
      fs.rmSync(directorio, { recursive: true, force: true });
    }
  });

  it("never passes an inherited shared deployment to Convex and refuses a non-local target", async () => {
    previo = fs.existsSync(envLocal) ? fs.readFileSync(envLocal) : null;
    fs.writeFileSync(envLocal, plantado);

    const directorio = fs.mkdtempSync(path.join(os.tmpdir(), "payvro-e2e-servidor-"));
    temporales.push(directorio);
    const registro = path.join(directorio, "registro");
    const bin = path.join(directorio, "bin");
    fs.mkdirSync(bin);
    escribirFalsoNpx(bin, registro);
    escribirFalsoNpm(bin, registro);

    const { codigo, stderr } = await ejecutarServidor(bin, registro);

    const texto = fs.readFileSync(registro, "utf8");
    const entorno = bloque(texto, "ENV_BEGIN", "ENV_END");
    expect(entorno).not.toContain("dev:shared-example");
    expect(entorno).not.toContain("shared.example");
    expect(entorno).not.toContain("key-shared-example");
    expect(entorno).not.toContain("admin-shared-example");
    expect(entorno).not.toContain("token-shared-example");
    expect(texto).toContain("--once");
    expect(fs.readFileSync(envLocal, "utf8")).toBe(plantado);
    expect(codigo).not.toBe(0);
    expect(stderr).toMatch(/local/);
  }, 20_000);
});

function escribirFalsoNpx(bin: string, registro: string): void {
  const script = `#!/usr/bin/env bash
{
  printf 'ARGV'
  printf ' %q' "$@"
  printf '\\nENV_BEGIN\\n'
  for nombre in HOME CONVEX_DEPLOYMENT CONVEX_URL NEXT_PUBLIC_CONVEX_URL CONVEX_DEPLOY_KEY CONVEX_DEPLOYMENT_TOKEN CONVEX_SELF_HOSTED_URL CONVEX_SELF_HOSTED_ADMIN_KEY; do
    if [[ -v $nombre ]]; then
      printf '%s=%s\\n' "$nombre" "\${!nombre}"
    else
      printf '%s=<unset>\\n' "$nombre"
    fi
  done
  env | grep '^CONVEX_SELF_HOSTED_' || true
  printf 'ENV_END\\n'
} >> ${JSON.stringify(registro)}
if [[ "$*" == *convex* ]]; then
  printf '%s\\n' 'CONVEX_DEPLOYMENT=dev:shared-example' 'NEXT_PUBLIC_CONVEX_URL=https://shared.example.convex.cloud' >> .env.local
fi
exit 0
`;
  fs.writeFileSync(path.join(bin, "npx"), script, { mode: 0o755 });
}

function escribirFalsoNpm(bin: string, registro: string): void {
  const script = `#!/usr/bin/env bash
printf 'NPM %q\\n' "$*" >> ${JSON.stringify(registro)}
exit 0
`;
  fs.writeFileSync(path.join(bin, "npm"), script, { mode: 0o755 });
}

function bloque(texto: string, inicio: string, fin: string): string {
  const desde = texto.indexOf(inicio);
  const hasta = texto.indexOf(fin);
  if (desde < 0 || hasta < 0 || hasta < desde) return texto;
  return texto.slice(desde + inicio.length, hasta);
}

function ejecutarServidor(
  bin: string,
  registro: string,
): Promise<{ codigo: number | null; stderr: string }> {
  const base = process.env.PATH ?? "";
  const child = spawn("bash", ["e2e/servidor.sh"], {
    cwd: raiz,
    detached: true,
    env: {
      ...process.env,
      ...heredado,
      PATH: `${bin}:${base}`,
      PAYVRO_E2E_REGISTRO: registro,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stderr = "";
  child.stderr?.on("data", (chunk: Buffer) => {
    stderr += chunk.toString("utf8");
  });

  return new Promise((resolve) => {
    const terminar = (codigo: number | null) => {
      clearTimeout(timer);
      resolve({ codigo, stderr });
    };
    const timer = setTimeout(() => {
      if (child.pid !== undefined) {
        try {
          process.kill(-child.pid, "SIGTERM");
        } catch {
          child.kill("SIGTERM");
        }
      }
      setTimeout(() => terminar(null), 500);
    }, 8_000);
    child.on("exit", (codigo) => terminar(codigo));
  });
}
