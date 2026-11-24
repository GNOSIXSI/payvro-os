export const TEXTO_MOTIVO = {
  monto_distinto: "El monto no coincide con el cobro.",
  destino_distinto: "El dinero no llegó a la cuenta del negocio.",
  metodo_no_permitido: "El pago no se hizo con CoDi.",
  con_propina: "El pago incluye propina.",
  duplicado: "Hay otro pago para este cobro.",
  pago_tardio: "El pago llegó después del vencimiento.",
  parcial: "El pago no cubre el monto completo.",
} as const;

export function textoDeEvento(tipo: string): string | null {
  return tipo === "pey.dato_ilegible" ? "Pey devolvió un dato ilegible" : null;
}

export type MotivoRevision = keyof typeof TEXTO_MOTIVO;

export function textoDeMotivo(motivo: string | undefined): string | null {
  if (!motivo || !(motivo in TEXTO_MOTIVO)) {
    return null;
  }
  return TEXTO_MOTIVO[motivo as MotivoRevision];
}
