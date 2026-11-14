import type { EvidenciaLink, PaginaTransacciones, TransaccionPey } from "./tipos";
export type ResultadoCrear =
  | { tipo: "creado"; peyPayableId: string; urlPago?: string; qrString?: string; requestId?: string }
  | { tipo: "rechazado"; httpStatus: number; errorType: string; requestId?: string }
  | { tipo: "incierto"; causa: "timeout" | "red" | "5xx" };
export interface PeyPuerto {
  crearLink(e: { intentoPublicId: string; cobroPublicId: string; montoCentavos: number; successUrl: string; backUrl: string }): Promise<ResultadoCrear>;
  crearQr(e: { intentoPublicId: string; cobroPublicId: string; montoCentavos: number; concepto: string; expiraSeg: number; numRef: string }): Promise<ResultadoCrear>;
  leerLink(id: string): Promise<EvidenciaLink>;
  leerTransaccion(id: string): Promise<TransaccionPey>;
  listarTransaccionesQr(id: string, nextToken?: string): Promise<PaginaTransacciones>;
  listarTransacciones(nextToken?: string): Promise<PaginaTransacciones>;
  leerCuenta(): Promise<{ codiStatus: string }>;
}
