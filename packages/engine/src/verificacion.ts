import type { TransaccionPey, EvidenciaLink } from "./pey/tipos";
function centavosDesdePesos(pesos: number): number {
  const centavos = Math.round(pesos * 100);
  if (!Number.isFinite(pesos) || pesos < 0 || Math.abs(pesos * 100 - centavos) > 1e-6 || !Number.isSafeInteger(centavos)) throw new RangeError("MONTO_INVALIDO");
  return centavos;
}
export interface Esperado { tipo: "link" | "qr"; peyPayableId: string; intentoPublicId: string; montoCentavos: number; destino: "cuenta_de_la_llave" | "bank_account_id" }
export interface Evidencia { link?: EvidenciaLink; transacciones: TransaccionPey[]; destinoConfirmado?: boolean }
export type MotivoRevision = "monto_distinto" | "destino_distinto" | "metodo_no_permitido" | "con_propina" | "duplicado" | "parcial";
export type Veredicto = { resultado: "sin_pago" } | { resultado: "coincide"; transacciones: TransaccionPey[] } | { resultado: "revisar"; motivo: MotivoRevision; transacciones: TransaccionPey[] };
export function evaluar(esperado: Esperado, evidencia: Evidencia): Veredicto {
  if (evidencia.link?.status === "partial") return { resultado: "revisar", motivo: "parcial", transacciones: evidencia.transacciones };
  const payableType = esperado.tipo === "link" ? "PAYMENT_LINK" : "API_CODI_QR";
  const pagadas = evidencia.transacciones.filter((t) => t.status === "PAID" && t.currency === "MXN" && t.payableType === payableType && t.payableId === esperado.peyPayableId);
  if (!pagadas.length) return { resultado: "sin_pago" };
  if (esperado.tipo === "link" && evidencia.link?.clientReferenceId !== esperado.intentoPublicId)
    return { resultado: "revisar", motivo: "destino_distinto", transacciones: pagadas };
  const noPermitido = pagadas.find((t) => t.paymentMethod !== "CODI");
  if (noPermitido) return { resultado: "revisar", motivo: "metodo_no_permitido", transacciones: pagadas };
  const propina = pagadas.find((t) => centavosDesdePesos(t.amountBreakdown.tip) > 0);
  if (propina) return { resultado: "revisar", motivo: "con_propina", transacciones: pagadas };
  if (esperado.destino === "bank_account_id" && evidencia.destinoConfirmado !== true)
    return { resultado: "revisar", motivo: "destino_distinto", transacciones: pagadas };
  if (pagadas.length > 1) return { resultado: "revisar", motivo: "duplicado", transacciones: pagadas };
  const tx = pagadas[0];
  if (centavosDesdePesos(tx.amount) !== centavosDesdePesos(tx.amountBreakdown.base + tx.amountBreakdown.fee + tx.amountBreakdown.tip))
    return { resultado: "revisar", motivo: "monto_distinto", transacciones: pagadas };
  return centavosDesdePesos(tx.amountBreakdown.base) === esperado.montoCentavos
    ? { resultado: "coincide", transacciones: pagadas }
    : { resultado: "revisar", motivo: "monto_distinto", transacciones: pagadas };
}
