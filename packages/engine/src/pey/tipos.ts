// These are normalized internal records, not literal pey HTTP wire shapes. WP-OS-03 maps provider `id`, epoch-second dates,
// nested `externalMetadata`, and `items` into these fields before policy evaluation.
export type TipoPayable = "PAYMENT_LINK" | "API_CODI_QR" | "API_CODI_PN";
export interface TransaccionPey {
  transactionId: string; status: "PENDING" | "PAID"; amount: number;
  amountBreakdown: { base: number; tip: number; fee: number };
  currency: string; paymentMethod: "CARD" | "CODI"; payableType: TipoPayable;
  payableId: string; dateCreated: string; datePaid?: string;
  metadata: Record<string, string>;
}
export interface EvidenciaLink { status: "pending" | "processing" | "paid" | "partial"; amount: number; clientReferenceId: string; metadata: Record<string, string>; transactions: Array<{ transactionId: string }> }
export interface PaginaTransacciones { transactions: TransaccionPey[]; nextToken?: string }
