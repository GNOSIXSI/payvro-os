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

async function crearPayable(
  store: SimStore,
  tipo: "link" | "qr",
  entrada: { intentoPublicId: string; montoCentavos: number },
): Promise<ResultadoCrear> {
  const id = await store.nextId();
  const url = `https://app.mipey.mx/payment-link/${id}`;
  await store.savePayable({ id, montoCentavos: entrada.montoCentavos, intentoPublicId: entrada.intentoPublicId, tipo, url });
  return { tipo: "creado", peyPayableId: id, ...(tipo === "link" ? { urlPago: url } : { qrString: `PAYVRO-DEMO:${id}` }) };
}

async function crearTransaccion(
  store: SimStore,
  payable: { montoCentavos: number; intentoPublicId: string; tipo: "link" | "qr" },
  payableId: string,
  variante: VariantePago,
): Promise<TransaccionPey[]> {
  const cantidad = variante === "duplicado" ? 2 : 1;
  const baseCentavos = payable.montoCentavos + (variante === "monto_distinto" ? 100 : 0);
  const feeCentavos = variante === "tarjeta" ? 600 : 0;
  const totalCentavos = baseCentavos + feeCentavos;
  const nuevas = Array.from({ length: cantidad }, (): TransaccionPey => ({
    transactionId: "",
    status: "PAID",
    amount: aPesos(totalCentavos),
    amountBreakdown: { base: aPesos(baseCentavos), fee: feeCentavos === 0 ? 0 : aPesos(feeCentavos), tip: 0 },
    currency: "MXN",
    paymentMethod: variante === "tarjeta" ? "CARD" : "CODI",
    payableType: payable.tipo === "link" ? "PAYMENT_LINK" : "API_CODI_QR",
    payableId,
    dateCreated: new Date(0).toISOString(),
    datePaid: new Date(0).toISOString(),
    metadata: { payvro_intento: payable.intentoPublicId, payvro_simulacion: variante },
  }));
  for (const transaccion of nuevas) transaccion.transactionId = await store.nextId();
  return nuevas;
}

async function simularPago(store: SimStore, id: string, variante: VariantePago): Promise<void> {
  const payable = await store.getPayable(id);
  if (!payable) throw new Error("NO_ENCONTRADO");
  const existentes = await store.getTransactions(id);
  if (existentes.some((transaccion) => transaccion.metadata.payvro_simulacion === variante)) return;
  const nuevas = await crearTransaccion(store, payable, id, variante);
  await store.saveTransactions(id, [...existentes, ...nuevas]);
}

async function leerLink(store: SimStore, id: string): Promise<EvidenciaLink> {
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
}

async function leerTransaccion(store: SimStore, id: string): Promise<TransaccionPey> {
  for (const payableId of await store.listPayableIds()) {
    const encontrada = (await store.getTransactions(payableId)).find((transaccion) => transaccion.transactionId === id);
    if (encontrada) return encontrada;
  }
  throw new Error("NO_ENCONTRADO");
}

async function listarTransacciones(store: SimStore): Promise<{ transactions: TransaccionPey[] }> {
  const todos: TransaccionPey[] = [];
  for (const payableId of await store.listPayableIds()) todos.push(...await store.getTransactions(payableId));
  return { transactions: todos };
}

export function crearSimulador(store: SimStore): PeyPuerto & { pagar(id: string, variante: VariantePago): Promise<void> } {
  return {
    crearLink: (entrada) => crearPayable(store, "link", entrada),
    crearQr: (entrada) => crearPayable(store, "qr", entrada),
    leerLink: (id) => leerLink(store, id),
    leerTransaccion: (id) => leerTransaccion(store, id),
    listarTransaccionesQr: async (id) => ({
      transactions: (await store.getTransactions(id)).map((transaccion) => ({ transactionId: transaccion.transactionId })),
      nextToken: null,
    }),
    listarTransacciones: async () => ({ ...(await listarTransacciones(store)), nextToken: null, descartadas: 0 }),
    listarTransaccionesCuenta: async () => ({ ...(await listarTransacciones(store)), nextToken: null, descartadas: 0 }),
    leerCuenta: async () => ({ codiStatus: "ACTIVE" }),
    pagar: (id, variante) => simularPago(store, id, variante),
  };
}
