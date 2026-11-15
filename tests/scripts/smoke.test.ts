import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SENTINELA = "SENTINEL_SMOKE_LLAVE";

function entorno(modo: "demo" | "live") {
  const directorio = mkdtempSync(path.join(tmpdir(), "payvro-smoke-"));
  const diagnostico = path.join(directorio, "diagnostico.json");
  const registro = path.join(directorio, "convex.log");
  const binario = path.join(directorio, "convex-falso.mjs");
  writeFileSync(
    diagnostico,
    JSON.stringify({
      modo,
      peyApiKey: true,
      peyBankAccountId: true,
      peyWebhookSecret: false,
      clerkJwtIssuerDomain: true,
      payvroPublicUrl: false,
      ownerEmails: 1,
      cuentaPey: modo === "live" ? "ACTIVE" : "no_aplica",
      secreto: SENTINELA,
    }),
  );
  writeFileSync(
    binario,
    `#!/usr/bin/env node
import { appendFileSync } from "node:fs";
appendFileSync(process.env.PAYVRO_FAKE_LOG, process.argv.slice(2).join(" ") + "\\n");
process.exit(3);
`,
  );
  chmodSync(binario, 0o755);
  return { diagnostico, registro, binario };
}

function correr(modo: "demo" | "live") {
  const preparado = entorno(modo);
  const corrida = spawnSync("node", ["scripts/smoke-demo.mjs", "--diagnostico", preparado.diagnostico], {
    encoding: "utf8",
    cwd: process.cwd(),
    env: {
      ...process.env,
      PAYVRO_CONVEX_BIN: preparado.binario,
      PAYVRO_FAKE_LOG: preparado.registro,
    },
  });
  return { corrida, registro: preparado.registro };
}

describe("smoke:demo", () => {
  it("refuses a live deployment before calling convex", () => {
    const { corrida, registro } = correr("live");
    const salida = `${corrida.stdout ?? ""}\n${corrida.stderr ?? ""}`;
    expect(corrida.status).toBe(1);
    expect(salida.toLowerCase()).toContain("live");
    expect(salida).not.toContain(SENTINELA);
    expect(salida).not.toContain("OK cobro creado");
    const llamadas = spawnSync("cat", [registro], { encoding: "utf8" }).stdout ?? "";
    expect(llamadas).toBe("");
  });

  it("does not refuse demo and continues toward the cobro", () => {
    const { corrida, registro } = correr("demo");
    const salida = `${corrida.stdout ?? ""}\n${corrida.stderr ?? ""}`;
    expect(salida.toLowerCase()).not.toContain("se rehúsa");
    expect(salida).not.toContain(SENTINELA);
    const llamadas = spawnSync("cat", [registro], { encoding: "utf8" }).stdout ?? "";
    expect(llamadas).toContain("cobros:crear");
    expect(corrida.status).not.toBe(0);
  });
});
