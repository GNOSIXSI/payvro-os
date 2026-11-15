import { aPesos } from "../money";
const pesosIncluidoCero = (centavos: number): number => centavos === 0 ? 0 : aPesos(centavos);
import type { PeyPuerto, ResultadoCrear } from "./puerto";
import type { EvidenciaLink, TransaccionPey } from "./tipos";

export type VariantePago = "exacto" | "monto_distinto" | "duplicado" | "tarjeta";
export interface SimStore {
  getPayable(id: string): { id: string; montoCentavos: number; intentoPublicId: string; tipo: "link" | "qr" } | null;
  savePayable(row: { id: string; montoCentavos: number; intentoPublicId: string; tipo: "link" | "qr"; url: string }): void;
  getTransactions(payableId: string): TransaccionPey[];
  saveTransactions(payableId: string, rows: TransaccionPey[]): void;
  nextId(): string;
  listPayableIds(): string[];
}
export function crearSimulador(store: SimStore): PeyPuerto & { pagar(id: string, variante: VariantePago): void } {
  const crear = async (tipo: "link" | "qr", e: { intentoPublicId: string; montoCentavos: number }): Promise<ResultadoCrear> => {
    const id = store.nextId();
    const url = `https://app.mipey.mx/payment-link/${id}`;
    store.savePayable({ id, montoCentavos: e.montoCentavos, intentoPublicId: e.intentoPublicId, tipo, url });
    return { tipo: "creado", peyPayableId: id, ...(tipo === "link" ? { urlPago: url } : { qrString: `PAYVRO-DEMO:${id}` }) };
  };
  return {
    crearLink: (e) => crear("link", e), crearQr: (e) => crear("qr", e),
    leerLink: async (id): Promise<EvidenciaLink> => { const p = store.getPayable(id); if (!p) throw new Error("NO_ENCONTRADO"); return { status: store.getTransactions(id).length ? "paid" : "pending", amount: aPesos(p.montoCentavos), clientReferenceId: p.intentoPublicId, metadata: { payvro_intento: p.intentoPublicId }, transactions: store.getTransactions(id).map((t) => ({ transactionId: t.transactionId })) }; },
    leerTransaccion: async (id) => { for (const p of allPayables()) { const tx = store.getTransactions(p); const found = tx.find((t) => t.transactionId === id); if (found) return found; } throw new Error("NO_ENCONTRADO"); },
    listarTransaccionesQr: async (id) => ({ transactions: store.getTransactions(id).map((t) => ({ transactionId: t.transactionId })), nextToken: null }),
    listarTransacciones: async () => ({ transactions: allPayables().flatMap((id) => store.getTransactions(id)), nextToken: null }),
    listarTransaccionesCuenta: async () => ({ transactions: allPayables().flatMap((id) => store.getTransactions(id)), nextToken: null }),
    leerCuenta: async () => ({ codiStatus: "ACTIVE" }),
    pagar: (id, variante) => {
      const p = store.getPayable(id); if (!p) throw new Error("NO_ENCONTRADO");
      const count = variante === "duplicado" ? 2 : 1;
      const rows = Array.from({ length: count }, (): TransaccionPey => {
        const baseCentavos = p.montoCentavos + (variante === "monto_distinto" ? -100 : 0);
        const feeCentavos = variante === "tarjeta" ? 600 : 0;
        const totalCentavos = baseCentavos + feeCentavos;
        return { transactionId: store.nextId(), status: "PAID", amount: aPesos(totalCentavos), amountBreakdown: { base: pesosIncluidoCero(baseCentavos), fee: pesosIncluidoCero(feeCentavos), tip: 0 }, currency: "MXN", paymentMethod: variante === "tarjeta" ? "CARD" : "CODI", payableType: p.tipo === "link" ? "PAYMENT_LINK" : "API_CODI_QR", payableId: id, dateCreated: new Date(0).toISOString(), datePaid: new Date(0).toISOString(), metadata: { payvro_intento: p.intentoPublicId } };
      });
      store.saveTransactions(id, [...store.getTransactions(id), ...rows]);
    },
  };
  function allPayables(): string[] { return store.listPayableIds(); }
}
