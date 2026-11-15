import { aPesos } from "../money";
import type { PeyPuerto, ResultadoCrear } from "./puerto";
import type { EvidenciaLink, TransaccionPey } from "./tipos";

export type VariantePago = "exacto" | "monto_distinto" | "duplicado" | "tarjeta";
type MaybePromise<T> = T | Promise<T>;

export interface SimStore {
  getPayable(id: string): MaybePromise<{ id: string; montoCentavos: number; intentoPublicId: string; tipo: "link" | "qr" } | null>;
  savePayable(row: { id: string; montoCentavos: number; intentoPublicId: string; tipo: "link" | "qr"; url: string }): MaybePromise<void>;
  getTransactions(payableId: string): MaybePromise<TransaccionPey[]>;
  saveTransactions(payableId: string, rows: TransaccionPey[]): MaybePromise<void>;
  nextId(): MaybePromise<string>;
  listPayableIds(): MaybePromise<string[]>;
}

export function crearSimulador(store: SimStore): PeyPuerto & { pagar(id: string, variante: VariantePago): Promise<void> } {
  const crear = async (tipo: "link" | "qr", e: { intentoPublicId: string; montoCentavos: number }): Promise<ResultadoCrear> => {
    const id = await store.nextId();
    const url = `https://app.mipey.mx/payment-link/${id}`;
    await store.savePayable({ id, montoCentavos: e.montoCentavos, intentoPublicId: e.intentoPublicId, tipo, url });
    return { tipo: "creado", peyPayableId: id, ...(tipo === "link" ? { urlPago: url } : { qrString: `PAYVRO-DEMO:${id}` }) };
  };
  return {
    crearLink: (e) => crear("link", e), crearQr: (e) => crear("qr", e),
    leerLink: async (id): Promise<EvidenciaLink> => {
      const payable = await store.getPayable(id);
      if (!payable) throw new Error("NO_ENCONTRADO");
      const transacciones = await store.getTransactions(id);
      return {
        status: transacciones.length ? "paid" : "pending",
        amount: aPesos(payable.montoCentavos),
        clientReferenceId: payable.intentoPublicId,
        metadata: { payvro_intento: payable.intentoPublicId },
        transactions: transacciones.map((transaccion) => ({ transactionId: transaccion.transactionId })),
      };
    },
    leerTransaccion: async (id) => {
      for (const payableId of await store.listPayableIds()) {
        const encontrada = (await store.getTransactions(payableId)).find((transaccion) => transaccion.transactionId === id);
        if (encontrada) return encontrada;
      }
      throw new Error("NO_ENCONTRADO");
    },
    listarTransaccionesQr: async (id) => ({ transactions: await store.getTransactions(id) }),
    listarTransacciones: async () => {
      const todos: TransaccionPey[] = [];
      for (const payableId of await store.listPayableIds()) todos.push(...await store.getTransactions(payableId));
      return { transactions: todos };
    },
    leerCuenta: async () => ({ codiStatus: "ACTIVE" }),
    pagar: async (id, variante) => {
      const payable = await store.getPayable(id);
      if (!payable) throw new Error("NO_ENCONTRADO");
      const existentes = await store.getTransactions(id);
      if (existentes.some((transaccion) => transaccion.metadata.payvro_simulacion === variante)) return;
      const cantidad = variante === "duplicado" ? 2 : 1;
      const nuevas = Array.from({ length: cantidad }, (): TransaccionPey => {
        const baseCentavos = payable.montoCentavos + (variante === "monto_distinto" ? 100 : 0);
        const feeCentavos = variante === "tarjeta" ? 600 : 0;
        const totalCentavos = baseCentavos + feeCentavos;
        return {
          transactionId: "",
          status: "PAID",
          amount: aPesos(totalCentavos),
          amountBreakdown: { base: aPesos(baseCentavos), fee: feeCentavos === 0 ? 0 : aPesos(feeCentavos), tip: 0 },
          currency: "MXN",
          paymentMethod: variante === "tarjeta" ? "CARD" : "CODI",
          payableType: payable.tipo === "link" ? "PAYMENT_LINK" : "API_CODI_QR",
          payableId: id,
          dateCreated: new Date(0).toISOString(),
          datePaid: new Date(0).toISOString(),
          metadata: { payvro_intento: payable.intentoPublicId, payvro_simulacion: variante },
        };
      });
      for (const transaccion of nuevas) transaccion.transactionId = await store.nextId();
      await store.saveTransactions(id, [...existentes, ...nuevas]);
    },
  };
}
