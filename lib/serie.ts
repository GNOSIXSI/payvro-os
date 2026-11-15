export type CobroParaSerie = {
  estado: string;
  montoCentavos: number;
  creadoEn: number;
  verificadoEn?: number;
  liberadoEn?: number;
};

export type RotuloIngresos = {
  titulo: string;
  prefijo: string;
  aviso: string | null;
};

export type DiaSerie = {
  clave: string;
  etiqueta: string;
  centavos: number;
};

const ZONA = "America/Mexico_City";
const ESTADOS_INGRESO = new Set(["pagado_verificado", "liberado"]);

// cobros.listar returns creadoEn only (ARCHITECTURE §8). verificadoEn and
// liberadoEn are read when a row actually carries them. Until the contract
// grows, the panel must use the creation-day label. Noted for WP-OS-05.

export function rotuloIngresos(opciones: { porCreacion: boolean; parcial: boolean }): RotuloIngresos {
  if (opciones.porCreacion) {
    return {
      titulo: "Cobros liberados por día de creación",
      prefijo: "Suma por día de creación",
      aviso: opciones.parcial ? "Datos parciales" : null,
    };
  }
  if (opciones.parcial) {
    return {
      titulo: "Muestra de cobros liberados",
      prefijo: "Suma de la muestra",
      aviso: "Datos parciales",
    };
  }
  return {
    titulo: "Ingresos de los últimos 7 días",
    prefijo: "Total de la semana",
    aviso: null,
  };
}

export function agrupaPorCreacion(cobros: readonly CobroParaSerie[]): boolean {
  let conto = false;
  for (const cobro of cobros) {
    if (!cuentaParaSerie(cobro)) {
      continue;
    }
    conto = true;
    if (instanteDeIngreso(cobro).porCreacion) {
      return true;
    }
  }
  return !conto;
}

export function leerMarcas(fila: object): { verificadoEn?: number; liberadoEn?: number } {
  const marcas: { verificadoEn?: number; liberadoEn?: number } = {};
  if ("verificadoEn" in fila && esInstante(fila.verificadoEn)) {
    marcas.verificadoEn = fila.verificadoEn;
  }
  if ("liberadoEn" in fila && esInstante(fila.liberadoEn)) {
    marcas.liberadoEn = fila.liberadoEn;
  }
  return marcas;
}

export function serieIngresos(
  cobros: readonly CobroParaSerie[],
  ahora: Date = new Date(),
): DiaSerie[] {
  const hoy = partesEnZona(ahora);
  const dias = Array.from({ length: 7 }, (_, indice) => diaCalendario(hoy, indice - 6));
  const totales = new Map(dias.map((dia) => [dia.clave, 0]));

  for (const cobro of cobros) {
    sumarSiCuenta(totales, cobro);
  }

  return dias.map((dia) => ({
    clave: dia.clave,
    etiqueta: dia.etiqueta,
    centavos: totales.get(dia.clave) ?? 0,
  }));
}

function partesEnZona(fecha: Date): { y: number; m: number; d: number } {
  const mapa = new Map(
    new Intl.DateTimeFormat("en-US", {
      timeZone: ZONA,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(fecha)
      .map((parte) => [parte.type, parte.value]),
  );

  return {
    y: Number(mapa.get("year")),
    m: Number(mapa.get("month")),
    d: Number(mapa.get("day")),
  };
}

function diaCalendario(
  hoy: { y: number; m: number; d: number },
  delta: number,
): { clave: string; etiqueta: string } {
  const corrido = new Date(Date.UTC(hoy.y, hoy.m - 1, hoy.d + delta));
  const y = corrido.getUTCFullYear();
  const m = corrido.getUTCMonth() + 1;
  const d = corrido.getUTCDate();
  const clave = `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const etiqueta = new Intl.DateTimeFormat("es-MX", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
  }).format(corrido);

  return { clave, etiqueta };
}

function sumarSiCuenta(totales: Map<string, number>, cobro: CobroParaSerie): void {
  if (!cuentaParaSerie(cobro)) {
    return;
  }
  const instante = instanteDeIngreso(cobro).en;
  if (!Number.isSafeInteger(instante)) {
    return;
  }

  const partes = partesEnZona(new Date(instante));
  const clave = `${String(partes.y).padStart(4, "0")}-${String(partes.m).padStart(2, "0")}-${String(partes.d).padStart(2, "0")}`;
  const previo = totales.get(clave);
  if (previo === undefined) {
    return;
  }

  const suma = previo + cobro.montoCentavos;
  if (!Number.isSafeInteger(suma)) {
    return;
  }
  totales.set(clave, suma);
}

function cuentaParaSerie(cobro: CobroParaSerie): boolean {
  if (!ESTADOS_INGRESO.has(cobro.estado)) {
    return false;
  }
  if (!Number.isSafeInteger(cobro.montoCentavos) || cobro.montoCentavos < 0) {
    return false;
  }
  return Number.isSafeInteger(cobro.creadoEn);
}

function instanteDeIngreso(cobro: CobroParaSerie): { en: number; porCreacion: boolean } {
  if (cobro.estado === "liberado" && esInstante(cobro.liberadoEn)) {
    return { en: cobro.liberadoEn, porCreacion: false };
  }
  if (esInstante(cobro.verificadoEn)) {
    return { en: cobro.verificadoEn, porCreacion: false };
  }
  if (esInstante(cobro.liberadoEn)) {
    return { en: cobro.liberadoEn, porCreacion: false };
  }
  return { en: cobro.creadoEn, porCreacion: true };
}

function esInstante(valor: unknown): valor is number {
  return typeof valor === "number" && Number.isSafeInteger(valor);
}
