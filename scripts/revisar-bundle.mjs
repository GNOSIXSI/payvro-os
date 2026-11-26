import { spawnSync } from "node:child_process";
import { lstatSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const nombresPrivados = ["PEY_API_KEY", "PEY_WEBHOOK_SECRET", "CLERK_SECRET_KEY", "CONVEX_DEPLOY_KEY"];
const canarios = ["payvro-build-canary-not-a-credential", process.env.PAYVRO_SENTINEL].filter(Boolean);
const severidades = ["info", "low", "moderate", "high", "critical"];
const grave = (nivel) => nivel === "high" || nivel === "critical";
const registro = (valor) => valor !== null && typeof valor === "object" && !Array.isArray(valor);

function contiene(ruta, marcadores) {
  const bytes = readFileSync(ruta);
  return marcadores.some((marcador) => bytes.includes(marcador));
}

function revisarDirectorio(ruta) {
  let archivos = 0;
  for (const entrada of readdirSync(ruta, { withFileTypes: true })) {
    const destino = join(ruta, entrada.name);
    if (entrada.isDirectory()) archivos += revisarDirectorio(destino);
    else if (entrada.isFile()) {
      if (contiene(destino, [...nombresPrivados, ...canarios])) throw new Error("Marcador prohibido en el bundle");
      archivos++;
    } else throw new Error("Entrada no regular en el bundle");
  }
  return archivos;
}

function revisarBundle() {
  const ruta = ".next/static";
  if (!lstatSync(ruta, { throwIfNoEntry: false })?.isDirectory() || !revisarDirectorio(ruta)) {
    throw new Error("No hay artefactos en .next/static; ejecuta el build primero");
  }
  console.log("Bundle público sin marcadores prohibidos.");
}

function leerExcepciones() {
  const texto = readFileSync("docs/auditoria-excepciones.md", "utf8");
  const bloques = [...texto.matchAll(/^```json\r?\n([\s\S]*?)\r?\n```$/gm)];
  const invalida = () => new Error("Excepción de auditoría inválida");
  if (bloques.length !== 1) throw invalida();
  const datos = JSON.parse(bloques[0][1]);
  if (!Array.isArray(datos)) throw invalida();
  const vigentes = new Set();
  const hoy = new Date().toISOString().slice(0, 10);
  for (const fila of datos) {
    if (!registro(fila)) throw invalida();
    const { paquete, advisory, vence, motivo } = fila;
    if (typeof paquete !== "string" || !paquete.trim() || !Number.isSafeInteger(advisory) || advisory <= 0 ||
      typeof motivo !== "string" || !motivo.trim() || typeof vence !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(vence)) {
      throw invalida();
    }
    const fecha = new Date(vence);
    if (!Number.isFinite(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== vence) throw invalida();
    if (vence >= hoy) vigentes.add(JSON.stringify([paquete, advisory]));
  }
  return vigentes;
}

function leerInforme() {
  const invalido = () => new Error("Informe npm audit inválido o no disponible");
  const resultado = spawnSync("npm", ["audit", "--omit=dev", "--audit-level=high", "--json"], {
    encoding: "utf8", maxBuffer: 8 * 1024 * 1024, timeout: 120_000,
  });
  if (resultado.error || resultado.signal) throw invalido();
  let informe;
  try { informe = JSON.parse(resultado.stdout); } catch { throw invalido(); }
  const conteo = informe?.metadata?.vulnerabilities;
  if (informe?.auditReportVersion !== 2 || informe.error || !registro(informe.vulnerabilities) || !registro(conteo)) throw invalido();
  const hallazgos = new Map(Object.entries(informe.vulnerabilities));
  const medido = Object.fromEntries(severidades.map((nivel) => [nivel, 0]));
  for (const [paquete, dato] of hallazgos) {
    if (!registro(dato) || dato.name !== paquete || !severidades.includes(dato.severity) || !Array.isArray(dato.via) || dato.via.length === 0) throw invalido();
    medido[dato.severity]++;
    for (const via of dato.via) {
      if (typeof via === "string" ? !hallazgos.has(via) : !registro(via) || !severidades.includes(via.severity) || !Number.isSafeInteger(via.source) || via.source <= 0) throw invalido();
    }
  }
  if (conteo.total !== hallazgos.size || severidades.some((nivel) => conteo[nivel] !== medido[nivel]) ||
    resultado.status !== (medido.high + medido.critical > 0 ? 1 : 0)) throw invalido();
  return hallazgos;
}

function revisarAuditoria() {
  const hallazgos = leerInforme();
  const excepciones = leerExcepciones();
  // npm includes metavulnerabilities (packages affected via another finding).
  // Each high/critical finding must reach an identifiable high/critical advisory.
  const faltantes = new Set();
  for (const [paquete, dato] of hallazgos) {
    if (!grave(dato.severity)) continue;
    const pendientes = [paquete];
    const visitados = new Set();
    let conAdvisory = false;
    while (pendientes.length) {
      const origen = pendientes.pop();
      if (visitados.has(origen)) continue;
      visitados.add(origen);
      for (const via of hallazgos.get(origen).via) {
        if (typeof via === "string") pendientes.push(via);
        else if (grave(via.severity)) {
          conAdvisory = true;
          if (!excepciones.has(JSON.stringify([origen, via.source]))) faltantes.add(via.source);
        }
      }
    }
    if (!conAdvisory) throw new Error("Informe npm audit inválido: hallazgo grave sin identificador de origen");
  }
  if (faltantes.size) throw new Error(`npm audit: hallazgos high/critical sin excepción vigente (advisory: ${[...faltantes].join(", ")})`);
  const graves = [...hallazgos.values()].filter((dato) => grave(dato.severity)).length;
  console.log(`npm audit: ${graves} hallazgo(s) high/critical; ninguno sin excepción vigente.`);
}

const [operacion, ...args] = process.argv.slice(2);
try {
  if (!operacion) revisarBundle();
  else if (operacion === "--audit" && args.length === 0) revisarAuditoria();
  else if (operacion === "--logs" && args.length > 0) {
    if (args.some((ruta) => contiene(ruta, canarios))) throw new Error("Marcador prohibido en logs del gate; no se publica la salida");
  } else throw new Error("Uso: revisar-bundle.mjs [--audit | --logs <archivo> ...]");
} catch (error) {
  // Do not echo file contents, npm diagnostics or parser excerpts.
  console.error(error instanceof SyntaxError || error.code ? "No se pudo verificar el artefacto o informe de seguridad" : error.message);
  process.exitCode = 1;
}
