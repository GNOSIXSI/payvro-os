import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const NOMBRES = [
  ["peyApiKey", "PEY_API_KEY"],
  ["peyBankAccountId", "PEY_BANK_ACCOUNT_ID"],
  ["peyWebhookSecret", "PEY_WEBHOOK_SECRET"],
  ["clerkJwtIssuerDomain", "CLERK_JWT_ISSUER_DOMAIN"],
  ["payvroPublicUrl", "PAYVRO_PUBLIC_URL"],
];
const CUENTAS = new Set(["ACTIVE", "PENDING", "PROCESSING", "ERROR", "no_se_pudo_consultar", "no_aplica"]);

export function interpretar(entrada) {
  const crudo = entrada && typeof entrada === "object" ? entrada : {};
  const modo = crudo.modo === "demo" || crudo.modo === "live" || crudo.modo === "ausente" ? crudo.modo : "invalido";
  const cuenta = CUENTAS.has(crudo.cuentaPey) ? crudo.cuentaPey : "no_se_pudo_consultar";
  const ownerEmails = Number.isSafeInteger(crudo.ownerEmails) && crudo.ownerEmails >= 0 ? crudo.ownerEmails : 0;
  return {
    modo,
    peyApiKey: crudo.peyApiKey === true,
    peyBankAccountId: crudo.peyBankAccountId === true,
    peyWebhookSecret: crudo.peyWebhookSecret === true,
    clerkJwtIssuerDomain: crudo.clerkJwtIssuerDomain === true,
    payvroPublicUrl: crudo.payvroPublicUrl === true,
    ownerEmails,
    cuenta,
  };
}

function linea(nombre, presente, detalle) {
  const estado = presente ? "presente" : "falta";
  return detalle ? `${nombre.padEnd(22)} ${estado} (${detalle})` : `${nombre.padEnd(22)} ${estado}`;
}

export function redactar(estado) {
  const filas = [];
  if (estado.modo === "demo" || estado.modo === "live") filas.push(linea("PAYVRO_MODE", true, estado.modo));
  else filas.push(linea("PAYVRO_MODE", false));
  for (const [campo, nombre] of NOMBRES) filas.push(linea(nombre, estado[campo]));
  filas.push(linea("PAYVRO_OWNER_EMAILS", estado.ownerEmails > 0, estado.ownerEmails > 0 ? String(estado.ownerEmails) : undefined));
  if (estado.modo === "live") {
    const cuenta = estado.cuenta === "no_se_pudo_consultar" ? "no se pudo consultar" : estado.cuenta;
    filas.push(`${"cuenta en pey".padEnd(22)} ${cuenta}`);
  }
  return filas.join("\n");
}

export function faltaRequerido(estado) {
  if (estado.modo === "invalido") return true;
  if (estado.modo !== "live") return false;
  return !estado.peyApiKey || !estado.peyBankAccountId || !estado.clerkJwtIssuerDomain || estado.ownerEmails < 1;
}

function binarioConvex() {
  if (process.env.PAYVRO_CONVEX_BIN) return process.env.PAYVRO_CONVEX_BIN;
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../node_modules/.bin/convex");
}

function objetoJson(salida) {
  const texto = salida.trim();
  try {
    return JSON.parse(texto);
  } catch {
    const inicio = texto.indexOf("{");
    const fin = texto.lastIndexOf("}");
    if (inicio >= 0 && fin > inicio) return JSON.parse(texto.slice(inicio, fin + 1));
    throw new Error("diagnostico_ilegible");
  }
}

function leerDeConvex() {
  const corrida = spawnSync(binarioConvex(), ["run", "diagnostico:revisar"], { encoding: "utf8" });
  if (corrida.status !== 0) throw new Error("diagnostico_ilegible");
  return objetoJson(corrida.stdout ?? "");
}

function leerResultado(argv) {
  const indice = argv.indexOf("--resultado");
  if (indice === -1) return leerDeConvex();
  const archivo = argv[indice + 1];
  if (!archivo) throw new Error("diagnostico_ilegible");
  return JSON.parse(readFileSync(archivo, "utf8"));
}

function main() {
  let estado;
  try {
    estado = interpretar(leerResultado(process.argv));
  } catch {
    process.stderr.write("no se pudo leer el diagnóstico\n");
    process.exit(1);
  }
  process.stdout.write(`${redactar(estado)}\n`);
  process.exit(faltaRequerido(estado) ? 1 : 0);
}

const invocado = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (invocado) main();
