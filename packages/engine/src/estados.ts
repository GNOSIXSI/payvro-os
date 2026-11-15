export type EstadoCobro = "borrador" | "esperando_pago" | "pagado_verificado" | "liberado" | "expirado" | "cancelado" | "en_revision";
export type EventoCobro = "intento_creado" | "coincide" | "revisar" | "expirar" | "cancelar" | "liberar" | "pago_tardio";
export type EstadoIntento = "reservado" | "creado" | "pagado" | "incierto" | "fallido" | "descartado";
export type EventoIntento = "crear" | "pagar" | "incierto" | "fallar" | "descartar";

export const transicionesCobro = {
  borrador: { intento_creado: "esperando_pago", cancelar: "cancelado" },
  esperando_pago: { coincide: "pagado_verificado", revisar: "en_revision", expirar: "expirado", cancelar: "cancelado" },
  pagado_verificado: { liberar: "liberado" },
  expirado: { pago_tardio: "en_revision" },
  cancelado: { pago_tardio: "en_revision" },
  liberado: {},
  en_revision: {},
} as const;

export const transicionesIntento = {
  reservado: { crear: "creado", incierto: "incierto", fallar: "fallido" },
  creado: { pagar: "pagado", descartar: "descartado" },
  incierto: { descartar: "descartado" },
  pagado: {}, fallido: {}, descartado: {},
} as const;

function transicionar<T extends string, E extends string>(tabla: Record<string, Partial<Record<string, string>>>, estado: T, evento: E): string {
  const siguiente = tabla[estado]?.[evento];
  if (!siguiente) throw new Error("TRANSICION_INVALIDA");
  return siguiente;
}

export function transicionarCobro(estado: EstadoCobro, evento: EventoCobro): EstadoCobro {
  return transicionar(transicionesCobro, estado, evento) as EstadoCobro;
}
export function transicionarIntento(estado: EstadoIntento, evento: EventoIntento): EstadoIntento {
  return transicionar(transicionesIntento, estado, evento) as EstadoIntento;
}
