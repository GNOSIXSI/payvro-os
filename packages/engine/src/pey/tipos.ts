// These are normalized internal records, not literal pey HTTP wire shapes. WP-OS-03 maps provider `id`, epoch-second dates,
// nested `externalMetadata`, and `items` into these fields before policy evaluation.
export type TipoPayable = "PAYMENT_LINK" | "API_CODI_QR" | "API_CODI_PN";

/** Dates remain ISO strings in the engine; the persistence boundary converts them to milliseconds. */
export interface TransaccionPey {
  transactionId: string;
  status: "PENDING" | "PAID";
  amount: number;
  amountBreakdown: { base: number; tip: number; fee: number };
  currency: string;
  paymentMethod: "CARD" | "CODI";
  payableType: TipoPayable;
  payableId: string;
  dateCreated: string;
  datePaid?: string;
  metadata: Record<string, string>;
}

export interface EvidenciaLink {
  status: "pending" | "processing" | "paid" | "partial";
  amount: number;
  clientReferenceId: string;
  metadata: Record<string, string>;
  transactions: Array<{ transactionId: string }>;
}

export interface ReferenciaTransaccion {
  transactionId: string;
}

export interface PaginaReferenciasTransacciones {
  transactions: ReferenciaTransaccion[];
  nextToken: string | null;
}

export interface PaginaTransacciones {
  transactions: TransaccionPey[];
  nextToken: string | null;
  /** Rows skipped because the payable shape was not recognized. Zero means every row was readable. */
  descartadas: number;
}

export interface TransaccionPeyWire {
  id: unknown;
  status: unknown;
  amount: unknown;
  amountBreakdown: unknown;
  currency: unknown;
  paymentMethod: unknown;
  payableType: unknown;
  payableId: unknown;
  dateCreated: unknown;
  datePaid?: unknown;
  metadata?: unknown;
}

export interface ReferenciaTransaccionWire {
  id: unknown;
}

export interface RespuestaCrearQrWire {
  id: unknown;
  qrString: unknown;
}

export interface CuentaPeyWire {
  id: unknown;
  codiStatus: unknown;
}

export interface PaginaTransaccionesWire {
  items: unknown;
  nextToken: unknown;
}

export interface PaginaReferenciasTransaccionesWire {
  items: unknown;
  nextToken: unknown;
}
