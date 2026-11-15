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
