export type VersionCable = { querySet: number; ts: string; identity: number };

export type PuenteNombre = {
  ids: Set<number>;
  peticiones: Map<number, string>;
  nombreAceptado: string | null;
  version: VersionCable | null;
  negocio: Registro | null;
  queryNegocio: number | null;
};

export function crearPuenteNombre(): PuenteNombre {
  return {
    ids: new Set(),
    peticiones: new Map(),
    nombreAceptado: null,
    version: null,
    negocio: null,
    queryNegocio: null,
  };
}

export function observarClienteNombre(puente: PuenteNombre, mensaje: string): void {
  recordarConsulta(puente.ids, mensaje);
  const data = objeto(mensaje);
  if (!data || data.type !== "Mutation" || data.udfPath !== "negocio:actualizarPerfil") {
    return;
  }
  if (typeof data.requestId !== "number") {
    return;
  }
  const nombre = nombreDeArgs(data.args);
  if (nombre === null) {
    return;
  }
  puente.peticiones.set(data.requestId, nombre);
}

export function responderNombre(
  puente: PuenteNombre,
  mensaje: string,
  aceptarGuardado: boolean,
): { mensaje: string; extra: string | null } {
  const data = objeto(mensaje);
  if (!data) {
    return { mensaje, extra: null };
  }
  if (data.type === "Transition") {
    return { mensaje: reescribirTransicion(puente, data, mensaje), extra: null };
  }
  if (data.type === "MutationResponse") {
    return reescribirMutacion(puente, data, mensaje, aceptarGuardado);
  }
  return { mensaje, extra: null };
}

export function recordarConsulta(ids: Set<number>, mensaje: string): void {
  const data = objeto(mensaje);
  if (!data || data.type !== "ModifyQuerySet" || !Array.isArray(data.modifications)) {
    return;
  }
  for (const mod of data.modifications) {
    aplicarModificacion(ids, mod);
  }
}

export function vaciarNombreNegocio(ids: ReadonlySet<number>, mensaje: string): string {
  const data = objeto(mensaje);
  if (!data || data.type !== "Transition" || !Array.isArray(data.modifications)) {
    return mensaje;
  }
  let cambio = false;
  for (const mod of data.modifications) {
    if (vaciarSiNegocio(ids, mod)) {
      cambio = true;
    }
  }
  return cambio ? JSON.stringify(data) : mensaje;
}

function aplicarModificacion(ids: Set<number>, mod: unknown): void {
  if (!esRegistro(mod) || typeof mod.queryId !== "number") {
    return;
  }
  if (mod.type === "Remove") {
    ids.delete(mod.queryId);
    return;
  }
  if (mod.type === "Add" && mod.udfPath === "negocio:obtener") {
    ids.add(mod.queryId);
  }
}

function vaciarSiNegocio(ids: ReadonlySet<number>, mod: unknown): boolean {
  if (!esRegistro(mod) || mod.type !== "QueryUpdated" || typeof mod.queryId !== "number") {
    return false;
  }
  if (!ids.has(mod.queryId) || !esRegistro(mod.value) || typeof mod.value.nombre !== "string") {
    return false;
  }
  mod.value.nombre = "";
  return true;
}

function reescribirTransicion(puente: PuenteNombre, data: Registro, mensaje: string): string {
  const fin = leerVersion(data.endVersion);
  if (fin) {
    puente.version = fin;
  }
  if (!Array.isArray(data.modifications)) {
    return mensaje;
  }
  let cambio = false;
  for (const mod of data.modifications) {
    if (aplicarNombre(puente, mod)) {
      cambio = true;
    }
  }
  return cambio ? JSON.stringify(data) : mensaje;
}

function aplicarNombre(puente: PuenteNombre, mod: unknown): boolean {
  if (!esRegistro(mod) || mod.type !== "QueryUpdated" || typeof mod.queryId !== "number") {
    return false;
  }
  if (!puente.ids.has(mod.queryId) || !esRegistro(mod.value) || typeof mod.value.nombre !== "string") {
    return false;
  }
  puente.queryNegocio = mod.queryId;
  puente.negocio = { ...mod.value };
  mod.value.nombre = puente.nombreAceptado ?? "";
  return true;
}

function reescribirMutacion(
  puente: PuenteNombre,
  data: Registro,
  mensaje: string,
  aceptarGuardado: boolean,
): { mensaje: string; extra: string | null } {
  if (!aceptarGuardado || typeof data.requestId !== "number" || puente.version === null) {
    return { mensaje, extra: null };
  }
  const nombre = puente.peticiones.get(data.requestId);
  if (nombre === undefined) {
    return { mensaje, extra: null };
  }
  puente.nombreAceptado = nombre;
  return {
    mensaje: JSON.stringify({
      type: "MutationResponse",
      requestId: data.requestId,
      success: true,
      result: { ok: true },
      ts: puente.version.ts,
      logLines: [],
    }),
    extra: transicionDelNombre(puente),
  };
}

function transicionDelNombre(puente: PuenteNombre): string | null {
  if (puente.version === null || puente.queryNegocio === null || puente.negocio === null) {
    return null;
  }
  return JSON.stringify({
    type: "Transition",
    startVersion: puente.version,
    endVersion: puente.version,
    modifications: [
      {
        type: "QueryUpdated",
        queryId: puente.queryNegocio,
        value: { ...puente.negocio, nombre: puente.nombreAceptado },
        logLines: [],
        journal: null,
      },
    ],
  });
}

function nombreDeArgs(args: unknown): string | null {
  const primero = Array.isArray(args) ? args[0] : args;
  if (!esRegistro(primero) || typeof primero.nombre !== "string") {
    return null;
  }
  const nombre = primero.nombre.trim();
  return nombre.length > 0 ? nombre : null;
}

function leerVersion(valor: unknown): VersionCable | null {
  if (!esRegistro(valor)) {
    return null;
  }
  if (typeof valor.querySet !== "number" || typeof valor.ts !== "string" || typeof valor.identity !== "number") {
    return null;
  }
  return { querySet: valor.querySet, ts: valor.ts, identity: valor.identity };
}

function objeto(mensaje: string): Registro | null {
  try {
    const data: unknown = JSON.parse(mensaje);
    return esRegistro(data) ? data : null;
  } catch (fallo: unknown) {
    if (fallo instanceof SyntaxError) {
      return null;
    }
    throw fallo;
  }
}

type Registro = Record<string, unknown>;

function esRegistro(valor: unknown): valor is Registro {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}
