import { describe, expect, it } from "vitest";
import { crearSimulador, type SimStore } from "../packages/engine/src/pey/simulador";
import type { TransaccionPey } from "../packages/engine/src/pey/tipos";
function store(): SimStore {
  const payables = new Map<string, { id: string; montoCentavos: number; intentoPublicId: string; tipo: "link" | "qr"; url: string }>();
  const transactions = new Map<string, TransaccionPey[]>(); let sequence = 0;
  return {
    getPayable: (id) => payables.get(id) ?? null,
    savePayable: (row) => { payables.set(row.id, row); },
    getTransactions: (id) => transactions.get(id) ?? [],
    saveTransactions: (id, rows) => { transactions.set(id, rows); },
    nextId: () => `sim_${++sequence}`,
    listPayableIds: () => [...payables.keys()],
  };
}
describe("DEMO pey simulator", () => {
  it("creates payables and returns pey-shaped evidence without network access", async () => {
    const simulator = crearSimulador(store());
    const created = await simulator.crearQr({ intentoPublicId: "int_example", cobroPublicId: "cob_example", montoCentavos: 14900, concepto: "Pedido de ejemplo", expiraSeg: 86400, numRef: "1" });
    expect(created.tipo).toBe("creado");
    if (created.tipo !== "creado") return;
    simulator.pagar(created.peyPayableId, "exacto");
    const listed = await simulator.listarTransaccionesQr(created.peyPayableId);
    expect(listed.transactions).toHaveLength(1);
    expect(listed.transactions[0]).toMatchObject({ status: "PAID", amount: 149, amountBreakdown: { base: 149, fee: 0, tip: 0 }, currency: "MXN", paymentMethod: "CODI", payableType: "API_CODI_QR" });
  });
  it("represents mismatch, duplicate and card payment variants distinctly", async () => {
    const simulator = crearSimulador(store());
    for (const [variant, expected] of [["monto_distinto", 148], ["duplicado", 149], ["tarjeta", 149]] as const) {
      const created = await simulator.crearLink({ intentoPublicId: `int_${variant}`, cobroPublicId: "cob_example", montoCentavos: 14900, successUrl: "https://example.invalid/success", backUrl: "https://example.invalid/back" });
      if (created.tipo !== "creado") throw new Error("expected payable");
      simulator.pagar(created.peyPayableId, variant);
      const rows = await simulator.listarTransaccionesQr(created.peyPayableId);
      expect(rows.transactions.length).toBe(variant === "duplicado" ? 2 : 1);
      expect(rows.transactions[0].amountBreakdown.base).toBe(expected);
      if (variant === "tarjeta") expect(rows.transactions[0].paymentMethod).toBe("CARD");
    }
  });
});
