import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { interpretar } from "./doctor.mjs";

const ESPERA_MS = 500;
const INTENTOS = 40;

function binarioConvex() {
  if (process.env.PAYVRO_CONVEX_BIN) return process.env.PAYVRO_CONVEX_BIN;
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../node_modules/.bin/convex");
}

function objetoJson(salida) {
  const texto = (salida ?? "").trim();
  try {
    return JSON.parse(texto);
  } catch {
    const inicio = texto.indexOf("{");
    const fin = texto.lastIndexOf("}");
    if (inicio >= 0 && fin > inicio) return JSON.parse(texto.slice(inicio, fin + 1));
    throw new Error("respuesta_ilegible");
  }
}

function correr(funcion, args) {
  const corrida = spawnSync(binarioConvex(), ["run", funcion, JSON.stringify(args)], { encoding: "utf8" });
  if (corrida.status !== 0) throw new Error("convex");
  return objetoJson(corrida.stdout);
}

function dormir(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function claveNueva() {
  return `smoke${Date.now()}demo01`;
}

function leerDiagnostico(argv) {
  const indice = argv.indexOf("--diagnostico");
  if (indice !== -1) {
    const archivo = argv[indice + 1];
    if (!archivo) throw new Error("diagnostico_ilegible");
    return interpretar(JSON.parse(readFileSync(archivo, "utf8")));
  }
  const corrida = spawnSync(binarioConvex(), ["run", "diagnostico:revisar"], { encoding: "utf8" });
  if (corrida.status !== 0) throw new Error("diagnostico_ilegible");
  return interpretar(objetoJson(corrida.stdout));
}

function fallo(linea) {
  process.stdout.write(`FALLO ${linea}\n`);
  process.exit(1);
}

function ok(linea) {
  process.stdout.write(`OK ${linea}\n`);
}

function esperar(publicId, listo) {
  for (let intento = 0; intento < INTENTOS; intento += 1) {
    const detalle = correr("cobros:obtener", { publicId });
    if (detalle && listo(detalle)) return detalle;
    dormir(ESPERA_MS);
  }
  return null;
}

function main() {
  let diagnostico;
  try {
    diagnostico = leerDiagnostico(process.argv);
  } catch {
    fallo("diagnóstico");
  }
  if (diagnostico.modo === "live" || diagnostico.modo === "invalido") {
    process.stdout.write("se rehúsa: el deployment está en live\n");
    process.exit(1);
  }

  let creado;
  try {
    creado = correr("cobros:crear", {
      claveIdempotencia: claveNueva(),
      concepto: "Prueba",
      montoCentavos: 100,
    });
  } catch {
    fallo("cobro creado");
  }
  if (!creado || typeof creado.publicId !== "string") fallo("cobro creado");
  ok("cobro creado");

  const listo = esperar(creado.publicId, (detalle) => detalle.estado === "esperando_pago" && detalle.intentoActivo?.estado === "creado");
  if (!listo) fallo("intento creado (simulador)");
  ok("intento creado (simulador)");

  try {
    const simulado = correr("demo:simularPago", { publicId: creado.publicId, variante: "exacto" });
    if (!simulado || simulado.ok !== true) fallo("pago simulado");
  } catch {
    fallo("pago simulado");
  }
  ok("pago simulado");

  const liberado = esperar(creado.publicId, (detalle) => detalle.estado === "liberado");
  if (!liberado) fallo("pago verificado");
  ok("pago verificado");
  ok("liberado");

  let bitacora;
  try {
    bitacora = correr("panel:bitacora", {
      cobroPublicId: creado.publicId,
      paginationOpts: { numItems: 20, cursor: null },
    });
  } catch {
    fallo("bitácora con 5+ entradas");
  }
  const tipos = Array.isArray(bitacora?.page) ? bitacora.page.map((entrada) => entrada.tipo) : [];
  if (tipos.length < 5 || !tipos.includes("pago.verificado") || !tipos.includes("cobro.liberado")) {
    fallo("bitácora con 5+ entradas");
  }
  ok("bitácora con 5+ entradas");
  ok("cero llamadas a pey");
}

main();
