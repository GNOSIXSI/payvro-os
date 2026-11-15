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
    await simulator.pagar(created.peyPayableId, "exacto");
    const listed = await simulator.listarTransaccionesQr(created.peyPayableId);
    expect(listed).toEqual({ transactions: [{ transactionId: expect.any(String) }], nextToken: null });
    const transaction = await simulator.leerTransaccion(listed.transactions[0].transactionId);
    expect(transaction).toMatchObject({ status: "PAID", amount: 149, amountBreakdown: { base: 149, fee: 0, tip: 0 }, currency: "MXN", paymentMethod: "CODI", payableType: "API_CODI_QR" });
    await expect(simulator.listarTransaccionesCuenta()).resolves.toMatchObject({ transactions: [transaction], nextToken: null });
  });
  it("keeps the mismatch variant valid and different for a one-centavo charge", async () => {
    const simulator = crearSimulador(store());
    const created = await simulator.crearQr({ intentoPublicId: "int_one_cent", cobroPublicId: "cob_example", montoCentavos: 1, concepto: "Pedido de ejemplo", expiraSeg: 86400, numRef: "1" });
    if (created.tipo !== "creado") throw new Error("expected payable");
    await simulator.pagar(created.peyPayableId, "monto_distinto");
    const rows = await simulator.listarTransaccionesQr(created.peyPayableId);
    expect(rows.transactions).toHaveLength(1);
    const transaction = await simulator.leerTransaccion(rows.transactions[0].transactionId);
    expect(transaction.amountBreakdown.base).toBe(1.01);
    expect(transaction.amount).toBe(1.01);
  });
  it("replays a variant idempotently while allowing a distinct duplicate-payment event", async () => {
    const simulator = crearSimulador(store());
    const created = await simulator.crearQr({ intentoPublicId: "int_replay", cobroPublicId: "cob_example", montoCentavos: 14900, concepto: "Pedido de ejemplo", expiraSeg: 86400, numRef: "1" });
    if (created.tipo !== "creado") throw new Error("expected payable");
    await simulator.pagar(created.peyPayableId, "exacto");
    await simulator.pagar(created.peyPayableId, "exacto");
    expect((await simulator.listarTransaccionesQr(created.peyPayableId)).transactions).toHaveLength(1);
    await simulator.pagar(created.peyPayableId, "duplicado");
    expect((await simulator.listarTransaccionesQr(created.peyPayableId)).transactions).toHaveLength(3);
  });
  it("represents mismatch, duplicate and card payment variants distinctly", async () => {
    const simulator = crearSimulador(store());
    for (const [variant, expected] of [["monto_distinto", 150], ["duplicado", 149], ["tarjeta", 149]] as const) {
      const created = await simulator.crearLink({ intentoPublicId: `int_${variant}`, cobroPublicId: "cob_example", montoCentavos: 14900, successUrl: "https://example.invalid/success", backUrl: "https://example.invalid/back" });
      if (created.tipo !== "creado") throw new Error("expected payable");
      await simulator.pagar(created.peyPayableId, variant);
      const rows = await simulator.listarTransaccionesQr(created.peyPayableId);
      expect(rows.transactions.length).toBe(variant === "duplicado" ? 2 : 1);
      const transaction = await simulator.leerTransaccion(rows.transactions[0].transactionId);
      expect(transaction.amountBreakdown.base).toBe(expected);
      if (variant === "tarjeta") expect(transaction.paymentMethod).toBe("CARD");
    }
  });
});
