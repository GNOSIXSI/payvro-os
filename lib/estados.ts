export const ESTADOS_COBRO = [
  "borrador",
  "esperando_pago",
  "pagado_verificado",
  "liberado",
  "en_revision",
  "expirado",
  "cancelado",
] as const;

export type EstadoCobro = (typeof ESTADOS_COBRO)[number];

export type ChipEstadoNombre = "neutral" | "amber" | "teal" | "petroleo" | "orange";

export type VistaEstado = {
  etiqueta: string;
  chip: ChipEstadoNombre;
};

const DUENO: Record<EstadoCobro, VistaEstado> = {
  borrador: { etiqueta: "Borrador", chip: "neutral" },
  esperando_pago: { etiqueta: "Esperando pago", chip: "amber" },
  pagado_verificado: { etiqueta: "Pago verificado", chip: "teal" },
  liberado: { etiqueta: "Liberado", chip: "petroleo" },
  en_revision: { etiqueta: "En revisión", chip: "orange" },
  expirado: { etiqueta: "Expirado", chip: "neutral" },
  cancelado: { etiqueta: "Cancelado", chip: "neutral" },
};

const PAGADOR: Record<EstadoCobro, VistaEstado> = {
  borrador: { etiqueta: "—", chip: "neutral" },
  esperando_pago: { etiqueta: "Esperando pago", chip: "amber" },
  pagado_verificado: { etiqueta: "Pago verificado", chip: "teal" },
  liberado: { etiqueta: "Pago verificado", chip: "petroleo" },
  en_revision: { etiqueta: "Estamos revisando tu pago", chip: "orange" },
  expirado: { etiqueta: "Este cobro ya no está disponible", chip: "neutral" },
  cancelado: { etiqueta: "Este cobro ya no está disponible", chip: "neutral" },
};

export function estadoParaDueno(estado: EstadoCobro): VistaEstado {
  return DUENO[estado];
}

export function estadoParaPagador(estado: EstadoCobro): VistaEstado {
  return PAGADOR[estado];
}

export function esEstadoCobro(valor: string): valor is EstadoCobro {
  return (ESTADOS_COBRO as readonly string[]).includes(valor);
}

const INTENTOS_TERMINALES = new Set(["pagado", "fallido", "descartado", "incierto"]);

export function intentoEsTerminal(estado: string): boolean {
  return INTENTOS_TERMINALES.has(estado);
}

export function vistaPagadorPorEtiqueta(etiqueta: string): VistaEstado {
  for (const estado of ESTADOS_COBRO) {
    const vista = PAGADOR[estado];
    if (vista.etiqueta === etiqueta) {
      return vista;
    }
  }
  return { etiqueta, chip: "neutral" };
}
