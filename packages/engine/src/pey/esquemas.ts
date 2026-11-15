import { aCentavos } from "../money";
import type {
  PaginaReferenciasTransacciones,
  PaginaTransacciones,
  TipoPayable,
  TransaccionPey,
  TransaccionPeyWire,
} from "./tipos";

const ULID = /^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$/;
const QR_ID = /^[A-Za-z0-9_-]{1,128}$/;
const CODI_PUSH_ID = /^[0-9]{20}$/;
const ERROR_TOKEN = /^[A-Z0-9_]{1,80}$/;
const REQUEST_ID = /^[A-Za-z0-9_-]{1,128}$/;
const CORRELATION_KEYS = ["payvro_cobro", "payvro_intento", "payvro_modo"] as const;
type CorrelationKey = (typeof CORRELATION_KEYS)[number];

function invalid(): never {
  throw new TypeError("PEY_FORMA_INESPERADA");
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return invalid();
  return value as Record<string, unknown>;
}

function string(value: unknown, maxLength = 4096): string {
  if (typeof value !== "string" || value.length < 1 || value.length > maxLength || /[\u0000-\u001f\u007f]/.test(value)) return invalid();
  return value;
}

function id(value: unknown, pattern: RegExp): string {
  const candidate = string(value, 128);
  if (!pattern.test(candidate)) return invalid();
  return candidate;
}

export function validarUlid(value: unknown): string {
  return id(value, ULID);
}

export function validarQrId(value: unknown): string {
  return id(value, QR_ID);
}

function validarPushId(value: unknown): string {
  return id(value, CODI_PUSH_ID);
}

export function validarPayvroId(value: unknown, prefix: "cob" | "int"): string {
  const candidate = id(value, new RegExp(`^${prefix}_[A-Za-z0-9_-]{1,128}$`));
  return candidate;
}

function fechaIsoDesdeSegundos(value: unknown): string {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) return invalid();
  try {
    return new Date(value * 1000).toISOString();
  } catch {
    return invalid();
  }
}

function pesos(value: unknown, allowZero = false): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || (!allowZero && value === 0)) return invalid();
  if (value === 0 && allowZero) return 0;
  try {
    aCentavos(value);
  } catch {
    return invalid();
  }
  return value;
}

function token(value: unknown): string | null {
  if (value === null) return null;
  return string(value);
}

function tipoPayable(value: unknown): TipoPayable {
  if (value === "PAYMENT_LINK" || value === "API_CODI_QR" || value === "API_CODI_PN") return value;
  return invalid();
}

function guardarCorrelacion(output: Record<string, string>, key: string, value: unknown): void {
  if (!CORRELATION_KEYS.includes(key as CorrelationKey)) return;
  const fieldValue = string(value, 128);
  if (key === "payvro_cobro" && !/^cob_[A-Za-z0-9_-]{1,128}$/.test(fieldValue)) return invalid();
  if (key === "payvro_intento" && !/^int_[A-Za-z0-9_-]{1,128}$/.test(fieldValue)) return invalid();
  if (key === "payvro_modo" && fieldValue !== "demo" && fieldValue !== "live") return invalid();
  output[key] = fieldValue;
}

function metadataAllowlisted(value: unknown): Record<string, string> {
  if (value === undefined || value === null) return {};
  const source = record(value);
  const output: Record<string, string> = {};
  if (source.trackingKey !== undefined) output.trackingKey = string(source.trackingKey, 256);
  for (const key of CORRELATION_KEYS) {
    if (source[key] !== undefined) guardarCorrelacion(output, key, source[key]);
  }

  const external = source.externalMetadata;
  if (external !== undefined && external !== null) {
    const externalRecord = record(external);
    for (const [key, fieldValue] of Object.entries(externalRecord)) {
      if (typeof fieldValue !== "string") return invalid();
      guardarCorrelacion(output, key, fieldValue);
    }
  }
  return output;
}

export function normalizarTransaccionPey(value: unknown): TransaccionPey {
  const wire = record(value) as unknown as TransaccionPeyWire;
  const transactionId = validarUlid(wire.id);
  if (wire.status !== "PENDING" && wire.status !== "PAID") return invalid();
  const status = wire.status;
  const amount = pesos(wire.amount);
  const amountBreakdown = record(wire.amountBreakdown);
  const base = pesos(amountBreakdown.base);
  const tip = amountBreakdown.tip === undefined ? 0 : pesos(amountBreakdown.tip, true);
  const fee = amountBreakdown.fee === undefined ? 0 : pesos(amountBreakdown.fee, true);
  if (typeof wire.currency !== "string" || !/^[A-Z]{3}$/.test(wire.currency)) return invalid();
  if (wire.paymentMethod !== "CARD" && wire.paymentMethod !== "CODI") return invalid();
  const payableType = tipoPayable(wire.payableType);
  const payableId = payableType === "API_CODI_QR" ? validarQrId(wire.payableId) : payableType === "API_CODI_PN" ? validarPushId(wire.payableId) : validarUlid(wire.payableId);
  const dateCreated = fechaIsoDesdeSegundos(wire.dateCreated);
  const datePaid = wire.datePaid === undefined ? undefined : fechaIsoDesdeSegundos(wire.datePaid);
  if (status === "PAID" && datePaid === undefined) return invalid();

  return {
    transactionId,
    status,
    amount,
    amountBreakdown: { base, tip, fee },
    currency: wire.currency,
    paymentMethod: wire.paymentMethod,
    payableType,
    payableId,
    dateCreated,
    ...(datePaid === undefined ? {} : { datePaid }),
    metadata: metadataAllowlisted(wire.metadata),
  };
}

function pageParts(value: unknown): { items: unknown[]; nextToken: string | null } {
  const page = record(value);
  if (!Array.isArray(page.items) || !Object.hasOwn(page, "nextToken")) return invalid();
  return { items: page.items, nextToken: token(page.nextToken) };
}

export function normalizarPaginaReferencias(value: unknown): PaginaReferenciasTransacciones {
  const { items, nextToken } = pageParts(value);
  const transactions = items.map((item) => ({ transactionId: validarUlid(record(item).id) }));
  return { transactions, nextToken };
}

export function normalizarPaginaTransacciones(value: unknown, cuentaConfigurada = false): PaginaTransacciones {
  const { items, nextToken } = pageParts(value);
  const transactions = items.map(normalizarTransaccionPey);
  if (cuentaConfigurada && transactions.some((tx) => tx.status !== "PAID" || tx.paymentMethod !== "CODI" || (tx.payableType !== "API_CODI_QR" && tx.payableType !== "API_CODI_PN"))) return invalid();
  return { transactions, nextToken };
}

export function normalizarRespuestaQr(value: unknown): { id: string; qrString: string } {
  const response = record(value);
  const qrString = string(response.qrString, 16_384);
  return { id: validarQrId(response.id), qrString };
}

export function normalizarCuenta(value: unknown, configuredId: string): { codiStatus: string } {
  const response = record(value);
  if (validarUlid(response.id) !== configuredId) return invalid();
  const status = response.codiStatus;
  if (status !== "PENDING" && status !== "PROCESSING" && status !== "ACTIVE" && status !== "ERROR") return invalid();
  return { codiStatus: status };
}

export function normalizarError(value: unknown): { errorType?: string; requestId?: string } {
  try {
    const root = record(value);
    const error = record(root.error);
    const result: { errorType?: string; requestId?: string } = {};
    if (typeof error.type === "string" && ERROR_TOKEN.test(error.type)) result.errorType = error.type;
    if (typeof error.requestId === "string" && REQUEST_ID.test(error.requestId)) result.requestId = error.requestId;
    return result;
  } catch {
    return {};
  }
}
