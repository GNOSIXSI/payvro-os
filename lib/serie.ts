export type CobroParaSerie = {
  estado: string;
  montoCentavos: number;
  creadoEn: number;
};

export type DiaSerie = {
  clave: string;
  etiqueta: string;
  centavos: number;
};

const ZONA = "America/Mexico_City";
const ESTADOS_INGRESO = new Set(["pagado_verificado", "liberado"]);

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
  if (!ESTADOS_INGRESO.has(cobro.estado)) {
    return;
  }
  if (!Number.isSafeInteger(cobro.montoCentavos) || cobro.montoCentavos < 0) {
    return;
  }
  if (!Number.isSafeInteger(cobro.creadoEn)) {
    return;
  }

  const partes = partesEnZona(new Date(cobro.creadoEn));
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
