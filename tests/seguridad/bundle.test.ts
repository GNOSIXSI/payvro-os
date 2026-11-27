// @vitest-environment node
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";

const raiz = process.cwd();
const canario = "pv04-example-canary-not-a-credential";
const canarioPredeterminado = "payvro-ci-canary-not-a-credential";
const vencimiento = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
const excepcion = { paquete: "paquete-ejemplo", advisory: 12345, vence: vencimiento, motivo: "Mitigación temporal revisada; retirar cuando salga el parche." };
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "pv04-gate-test-"));
  for (const sub of ["bin", "scripts", "docs", ".next/static/chunks"]) mkdirSync(join(dir, sub), { recursive: true });
  for (const file of ["scripts/gate.sh", "scripts/revisar-bundle.mjs"]) {
    if (existsSync(resolve(raiz, file))) copyFileSync(resolve(raiz, file), join(dir, file));
  }
  writeFileSync(join(dir, ".next/static/chunks/ejemplo.js"), "export const normal = true;");
  excepciones([]);
  // Keep the actual gate/scanner; stub only subcommands at their process boundary.
  writeFileSync(join(dir, "bin/npm"), `#!/bin/bash
case "$*" in
  'run bundle:revisar') exec node scripts/revisar-bundle.mjs ;;
  'run audit') exec node scripts/revisar-bundle.mjs --audit ;;
  'audit --omit=dev --audit-level=high --json') cat audit-fixture.json; exit "$AUDIT_STATUS" ;;
  'run build')
    rm -f .next/static/chunks/e2e.js
    if [[ -n "\${VERIFICAR_CANARIO:-}" && "$PAYVRO_SENTINEL" != "$VERIFICAR_CANARIO" ]]; then
      echo 'el build no recibió el canario esperado'; exit 42
    fi
    printf '%s\\n' 'build-fixture-marker' "\${LOG_FIXTURE:-output normal}"; exit "\${BUILD_STATUS:-0}" ;;
  'run secrets') echo 'secrets-fixture-ran' ;;
  'run e2e')
    if [[ -n "\${VERIFICAR_CANARIO:-}" && "$PAYVRO_SENTINEL" != "$VERIFICAR_CANARIO" ]]; then
      echo 'la reconstrucción E2E no recibió el canario esperado'; exit 42
    fi
    if [[ -n "\${E2E_BUNDLE_FIXTURE:-}" ]]; then
      printf '%s\\n' "$E2E_BUNDLE_FIXTURE" > .next/static/chunks/e2e.js
    fi ;;
  'run typecheck'|'run lint'|'test') : ;;
  *) exit 99 ;;
esac
`, { mode: 0o700 });
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

function excepciones(datos: unknown[]) {
  writeFileSync(join(dir, "docs/auditoria-excepciones.md"), `# Excepciones\n\n\`\`\`json\n${JSON.stringify(datos)}\n\`\`\`\n`);
}

function reporte(tipo: "none" | "high" | "critical" | "meta" | "error" | "moderate" | "high-subestimado" | "mixed" = "none") {
  const severity = tipo === "high-subestimado" ? "moderate" : tipo === "critical" || tipo === "moderate" ? tipo : "high";
  const via = [{ source: 12345, severity: tipo === "high-subestimado" ? "high" : severity }];
  if (tipo === "mixed") via.push({ source: 12346, severity: "moderate" });
  const finding = { name: "paquete-ejemplo", severity, via, range: "<2.0.0" };
  const vulnerabilities = tipo === "error" ? undefined : tipo === "none" ? {} : {
    "paquete-ejemplo": finding,
    ...(tipo === "meta" ? { "consumidor-ejemplo": { name: "consumidor-ejemplo", severity: "high", via: ["paquete-ejemplo"], range: "*" } } : {}),
  };
  const high = tipo === "meta" ? 2 : tipo === "high" || tipo === "mixed" ? 1 : 0;
  const critical = tipo === "critical" ? 1 : 0;
  const moderate = tipo === "moderate" || tipo === "high-subestimado" ? 1 : 0;
  writeFileSync(join(dir, "audit-fixture.json"), JSON.stringify(tipo === "error" ? { error: { code: "E503" } } : {
    auditReportVersion: 2, vulnerabilities, metadata: { vulnerabilities: { info: 0, low: 0, moderate, high, critical, total: moderate + high + critical } },
  }));
  return tipo === "error" || high + critical > 0 ? "1" : "0";
}

function gate(tipo: Parameters<typeof reporte>[0] = "none", env?: Record<string, string | undefined>) {
  const result = spawnSync("bash", ["scripts/gate.sh"], {
    cwd: dir, encoding: "utf8", timeout: 15_000,
    env: { ...process.env, PATH: `${join(dir, "bin")}:${process.env.PATH}`, PAYVRO_SENTINEL: canario, AUDIT_STATUS: reporte(tipo), ...env },
  });
  if (result.error) throw result.error;
  return { exit: result.status, output: result.stdout + result.stderr };
}

it.each([canario, "PEY_API_KEY", "PEY_WEBHOOK_SECRET", "CLERK_SECRET_KEY", "CONVEX_DEPLOY_KEY"])("hace fallar el gate con un marcador prohibido en un chunk anidado y pasa al retirarlo (%s)", (marcador) => {
  const chunk = join(dir, ".next/static/chunks/ejemplo.js");
  writeFileSync(chunk, `export const fixture = ${JSON.stringify(marcador)};`);
  const fallo = gate();
  expect(fallo.exit).toBe(1);
  expect(fallo.output).toContain("Marcador prohibido en el bundle");
  expect(fallo.output).not.toContain(marcador);
  writeFileSync(chunk, "export const normal = true;");
  const limpio = gate();
  expect(limpio.exit).toBe(0);
  expect(limpio.output).toContain("secrets-fixture-ran");
});

it("revisa también el bundle producido durante E2E", () => {
  expect(gate("none", { E2E_BUNDLE_FIXTURE: canario })).toMatchObject({ exit: 1, output: expect.stringContaining("Marcador prohibido en el bundle") });
  expect(gate("none", { E2E_BUNDLE_FIXTURE: "normal" })).toMatchObject({ exit: 0, output: expect.stringContaining("secrets-fixture-ran") });
});

it.each([
  [undefined, canarioPredeterminado],
  [canario, canario],
])("propaga el canario del gate a ambos builds y revisa sus salidas (%s)", (PAYVRO_SENTINEL, esperado) => {
  const entorno = { PAYVRO_SENTINEL, VERIFICAR_CANARIO: esperado };
  expect(gate("none", entorno)).toMatchObject({ exit: 0, output: expect.stringContaining("secrets-fixture-ran") });
  const log = gate("none", { ...entorno, LOG_FIXTURE: esperado });
  expect(log).toMatchObject({ exit: 1, output: expect.stringContaining("Marcador prohibido en logs del gate") });
  expect(log.output).not.toContain(esperado);
  expect(gate("none", { ...entorno, E2E_BUNDLE_FIXTURE: esperado })).toMatchObject({ exit: 1, output: expect.stringContaining("Marcador prohibido en el bundle") });
});

it("no publica logs con el canario, incluso si el comando falla; limpia la salida y preserva su exit", () => {
  for (const status of ["0", "42"]) {
    const fallo = gate("none", { LOG_FIXTURE: canario, BUILD_STATUS: status });
    expect(fallo.exit).toBe(1);
    expect(fallo.output).toContain("Marcador prohibido en logs del gate");
    expect(fallo.output).not.toContain(canario);
  }
  const limpio = gate();
  expect(limpio.exit).toBe(0);
  expect(limpio.output).toContain("build-fixture-marker");
  expect(gate("none", { BUILD_STATUS: "42" }).exit).toBe(42);
});

it.each(["high", "critical", "meta"] as const)("el gate rechaza hallazgos %s sin excepción vigente y justificada", (tipo) => {
  expect(gate(tipo)).toMatchObject({ exit: 1, output: expect.stringContaining("sin excepción vigente") });
  excepciones([{ ...excepcion, advisory: 99999 }]);
  expect(gate(tipo)).toMatchObject({ exit: 1, output: expect.stringContaining("sin excepción vigente") });
  excepciones([{ ...excepcion, vence: "2000-01-01" }]);
  expect(gate(tipo)).toMatchObject({ exit: 1, output: expect.stringContaining("sin excepción vigente") });
  excepciones([{ ...excepcion, motivo: " " }]);
  expect(gate(tipo)).toMatchObject({ exit: 1, output: expect.stringContaining("Excepción de auditoría inválida") });
  excepciones([excepcion]);
  expect(gate(tipo)).toMatchObject({ exit: 0, output: expect.stringContaining("secrets-fixture-ran") });
});

it("un informe inválido o un exit incoherente de npm fallan cerrado", () => {
  for (const [tipo, AUDIT_STATUS] of [["error", "0"], ["none", "1"], ["high", "0"]] as const) {
    expect(gate(tipo, { AUDIT_STATUS })).toMatchObject({ exit: 1, output: expect.stringContaining("Informe npm audit inválido") });
  }
  expect(gate("moderate")).toMatchObject({ exit: 0, output: expect.stringContaining("secrets-fixture-ran") });
});

it("no admite un advisory high bajo una fila moderate ni exige excepción para advisories moderate", () => {
  expect(gate("high-subestimado")).toMatchObject({ exit: 1, output: expect.stringContaining("Informe npm audit inválido") });
  excepciones([excepcion]);
  expect(gate("mixed")).toMatchObject({ exit: 0, output: expect.stringContaining("secrets-fixture-ran") });
  excepciones([]);
  expect(gate("mixed")).toMatchObject({ exit: 1, output: expect.stringContaining("sin excepción vigente") });
});

it("no considera limpio un bundle vacío ni uno que contiene un enlace no escaneable", () => {
  const chunk = join(dir, ".next/static/chunks/ejemplo.js");
  rmSync(chunk);
  expect(gate()).toMatchObject({ exit: 1, output: expect.stringContaining("No hay artefactos") });
  writeFileSync(chunk, "export const normal = true;");
  const enlace = join(dir, ".next/static/chunks/referencia.js");
  symlinkSync("no-existe.js", enlace);
  expect(gate()).toMatchObject({ exit: 1, output: expect.stringContaining("Entrada no regular") });
  rmSync(enlace);
  expect(gate()).toMatchObject({ exit: 0, output: expect.stringContaining("secrets-fixture-ran") });
});
