import { afterEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import { internal } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import { revisar } from "../../convex/diagnostico";

const SENTINELA_LLAVE = "SENTINEL_LLAVE_9f3a";
const SENTINELA_CUENTA = "SENTINEL_CUENTA_01J";
const SENTINELA_CORREO = "persona@sentinel.invalid";

function harness() {
  return convexTest(schema, import.meta.glob("../../convex/**/*.ts"));
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("diagnostico.revisar", () => {
  it("is an internal action, so the browser client cannot call it", () => {
    expect((revisar as { isInternal?: boolean }).isInternal).toBe(true);
  });

  it("returns booleans and a count, never the sentinel values", async () => {
    vi.stubEnv("PAYVRO_MODE", "demo");
    vi.stubEnv("PEY_API_KEY", SENTINELA_LLAVE);
    vi.stubEnv("PEY_BANK_ACCOUNT_ID", SENTINELA_CUENTA);
    vi.stubEnv("PAYVRO_OWNER_EMAILS", `${SENTINELA_CORREO},otra@sentinel.invalid`);
    vi.stubEnv("CLERK_JWT_ISSUER_DOMAIN", "");
    vi.stubEnv("PEY_WEBHOOK_SECRET", "");
    vi.stubEnv("PAYVRO_PUBLIC_URL", "");

    const resultado = await harness().action(internal.diagnostico.revisar, {});
    const serializado = JSON.stringify(resultado);

    expect(resultado).toMatchObject({
      modo: "demo",
      peyApiKey: true,
      peyBankAccountId: true,
      ownerEmails: 2,
      cuentaPey: "no_aplica",
    });
    expect(serializado).not.toContain(SENTINELA_LLAVE);
    expect(serializado).not.toContain(SENTINELA_CUENTA);
    expect(serializado).not.toContain("sentinel.invalid");
  });

  it("reports a missing live key as false and does not echo it", async () => {
    vi.stubEnv("PAYVRO_MODE", "live");
    vi.stubEnv("PEY_API_KEY", "");
    vi.stubEnv("PEY_BANK_ACCOUNT_ID", SENTINELA_CUENTA);
    vi.stubEnv("PAYVRO_OWNER_EMAILS", SENTINELA_CORREO);

    const resultado = await harness().action(internal.diagnostico.revisar, {});

    expect(resultado.modo).toBe("live");
    expect(resultado.peyApiKey).toBe(false);
    expect(resultado.peyBankAccountId).toBe(true);
    expect(resultado.ownerEmails).toBe(1);
    expect(resultado.cuentaPey).not.toBe("no_aplica");
    expect(JSON.stringify(resultado)).not.toContain(SENTINELA_CUENTA);
    expect(JSON.stringify(resultado)).not.toContain("sentinel.invalid");
  });
});
