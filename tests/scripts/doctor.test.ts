import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SENTINELA_LLAVE = "SENTINEL_LLAVE_9f3a";
const SENTINELA_CORREO = "persona@sentinel.invalid";
const SENTINELA_CUENTA = "SENTINEL_CUENTA_01J";

const NOMBRES = [
  "PAYVRO_MODE",
  "PEY_API_KEY",
  "PEY_BANK_ACCOUNT_ID",
  "PEY_WEBHOOK_SECRET",
  "CLERK_JWT_ISSUER_DOMAIN",
  "PAYVRO_OWNER_EMAILS",
  "PAYVRO_PUBLIC_URL",
] as const;

function correr(resultado: unknown) {
  const directorio = mkdtempSync(path.join(tmpdir(), "payvro-doctor-"));
  const archivo = path.join(directorio, "resultado.json");
  writeFileSync(archivo, JSON.stringify(resultado));
  return spawnSync("node", ["scripts/doctor.mjs", "--resultado", archivo], {
    encoding: "utf8",
    cwd: process.cwd(),
  });
}

function texto(resultado: ReturnType<typeof correr>): string {
  return `${resultado.stdout ?? ""}\n${resultado.stderr ?? ""}`;
}

describe("doctor", () => {
  it("prints section B names and states and never a sentinel value", () => {
    const corrida = correr({
      modo: "demo",
      peyApiKey: false,
      peyBankAccountId: false,
      peyWebhookSecret: false,
      clerkJwtIssuerDomain: false,
      payvroPublicUrl: false,
      ownerEmails: 0,
      cuentaPey: "no_aplica",
      peyApiKeyValor: SENTINELA_LLAVE,
      correos: SENTINELA_CORREO,
      cuenta: SENTINELA_CUENTA,
    });

    expect(corrida.status).toBe(0);
    const salida = texto(corrida);
    for (const nombre of NOMBRES) {
      expect(salida).toContain(nombre);
    }
    expect(salida).toContain("presente (demo)");
    expect(salida).toContain("falta");
    expect(salida).not.toContain(SENTINELA_LLAVE);
    expect(salida).not.toContain(SENTINELA_CORREO);
    expect(salida).not.toContain(SENTINELA_CUENTA);
    expect(salida).not.toContain("cuenta en pey");
  });

  it("exits 1 when a variable required for live is missing and still hides sentinels", () => {
    const corrida = correr({
      modo: "live",
      peyApiKey: false,
      peyBankAccountId: true,
      peyWebhookSecret: false,
      clerkJwtIssuerDomain: true,
      payvroPublicUrl: false,
      ownerEmails: 2,
      cuentaPey: "ACTIVE",
      peyApiKeyValor: SENTINELA_LLAVE,
      correos: SENTINELA_CORREO,
    });

    expect(corrida.status).toBe(1);
    const salida = texto(corrida);
    expect(salida).toContain("PAYVRO_MODE");
    expect(salida).toContain("presente (live)");
    expect(salida).toContain("PEY_API_KEY");
    expect(salida).toContain("falta");
    expect(salida).toContain("presente (2)");
    expect(salida).toContain("cuenta en pey");
    expect(salida).toContain("ACTIVE");
    expect(salida).not.toContain(SENTINELA_LLAVE);
    expect(salida).not.toContain(SENTINELA_CORREO);
  });

  it("does not echo an invalid mode string", () => {
    const corrida = correr({
      modo: SENTINELA_LLAVE,
      peyApiKey: true,
      peyBankAccountId: true,
      peyWebhookSecret: false,
      clerkJwtIssuerDomain: true,
      payvroPublicUrl: false,
      ownerEmails: 1,
      cuentaPey: "no_aplica",
    });

    expect(corrida.status).toBe(1);
    expect(texto(corrida)).not.toContain(SENTINELA_LLAVE);
  });
});
