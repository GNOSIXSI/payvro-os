import { describe, expect, it } from "vitest";
import { evaluar, type Esperado, type Evidencia } from "../packages/engine/src/verificacion";
import type { EvidenciaLink } from "../packages/engine/src/pey/tipos";
const esperado: Esperado = { tipo: "link", peyPayableId: "payable", intentoPublicId: "int_1234567890123456", montoCentavos: 14900, destino: "cuenta_de_la_llave" };
function transaction(overrides: Partial<Evidencia["transacciones"][number]> = {}) {
  return { transactionId: "tx", status: "PAID" as const, amount: 155, amountBreakdown: { base: 149, fee: 6, tip: 0 }, currency: "MXN", paymentMethod: "CODI" as const, payableType: "PAYMENT_LINK" as const, payableId: "payable", dateCreated: "2026-01-01", metadata: {}, ...overrides };
}
const evidence = (transacciones: Evidencia["transacciones"], link: EvidenciaLink = { status: "paid", amount: 149, clientReferenceId: esperado.intentoPublicId, metadata: {}, transactions: [] }): Evidencia => ({ transacciones, link });
describe("payment verification policy", () => {
  it("accepts expected base even when pey adds a fee to total", () => {
    expect(evaluar(esperado, evidence([transaction()])).resultado).toBe("coincide");
  });
  it("rejects a base that is short by 100 centavos", () => {
    expect(evaluar(esperado, evidence([transaction({ amountBreakdown: { base: 148, fee: 6, tip: 0 }, amount: 154 })]))).toMatchObject({ resultado: "revisar", motivo: "monto_distinto" });
  });
  it("rejects a base above the expected amount", () => {
    expect(evaluar(esperado, evidence([transaction({ amountBreakdown: { base: 150, fee: 6, tip: 0 }, amount: 156 })]))).toMatchObject({ resultado: "revisar", motivo: "monto_distinto" });
  });
  it("does not accept CARD payments", () => {
    expect(evaluar(esperado, evidence([transaction({ paymentMethod: "CARD" })]))).toMatchObject({ resultado: "revisar", motivo: "metodo_no_permitido" });
  });
  it("holds tip, partial links and duplicate paid transactions for review", () => {
    expect(evaluar(esperado, evidence([transaction({ amountBreakdown: { base: 149, fee: 0, tip: 6 }, amount: 155 })]))).toMatchObject({ motivo: "con_propina" });
    expect(evaluar(esperado, evidence([], { status: "partial", amount: 149, clientReferenceId: esperado.intentoPublicId, metadata: {}, transactions: [] }))).toMatchObject({ motivo: "parcial" });
    expect(evaluar(esperado, evidence([transaction(), transaction({ transactionId: "tx2" })]))).toMatchObject({ motivo: "duplicado" });
  });
  it("ignores pending, unrelated payable and non-MXN transactions", () => {
    expect(evaluar(esperado, evidence([transaction({ status: "PENDING" })])).resultado).toBe("sin_pago");
    expect(evaluar(esperado, evidence([transaction({ payableId: "other" })])).resultado).toBe("sin_pago");
    expect(evaluar(esperado, evidence([transaction({ currency: "USD" })])).resultado).toBe("sin_pago");
  });
  it("returns no payment for empty evidence and refuses a mismatched link reference", () => {
    expect(evaluar(esperado, evidence([])).resultado).toBe("sin_pago");
    expect(evaluar(esperado, evidence([transaction()], { status: "paid", amount: 149, clientReferenceId: "other", metadata: {}, transactions: [] }))).toMatchObject({ resultado: "revisar", motivo: "destino_distinto" });
  });
});
