import { aPesos } from "../money";
import type { PeyPuerto, ResultadoCrear } from "./puerto";
import {
  normalizarCuenta,
  normalizarError,
  normalizarPaginaReferencias,
  normalizarPaginaTransacciones,
  normalizarRespuestaQr,
  normalizarTransaccionPey,
  validarPayvroId,
  validarQrId,
  validarUlid,
} from "./esquemas";
import type { EvidenciaLink, PaginaTransacciones, TransaccionPey } from "./tipos";

const BASE_URL = "https://api.pey.mx";
const TIMEOUT_MS = 10_000;
const GET_RETRIES = 2;
const GET_RETRY_DELAYS_MS = [100, 200] as const;

type CodigoError = "PEY_CAPACIDAD_NO_DISPONIBLE" | "MODO_INVALIDO" | "PEY_ARGUMENTO_INVALIDO" | "PEY_TIMEOUT" | "PEY_RED" | "PEY_RATE_LIMIT" | "PEY_HTTP" | "PEY_FORMA_INESPERADA";

export class PeyClientError extends Error {
  readonly codigo: CodigoError;
  readonly httpStatus?: number;
  readonly requestId?: string;

  constructor(codigo: CodigoError, options: { httpStatus?: number; requestId?: string } = {}) {
    super(codigo);
    this.name = "PeyClientError";
    this.codigo = codigo;
    this.httpStatus = options.httpStatus;
    this.requestId = options.requestId;
  }
}

export interface PeyClienteOpciones {
  apiKey: string;
  bankAccountId: string;
  fetch: typeof globalThis.fetch;
  modo: string;
}

function argumentoValido(validar: () => string): string {
  try {
    return validar();
  } catch {
    throw new PeyClientError("PEY_ARGUMENTO_INVALIDO");
  }
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function timeout(error: unknown, signal: AbortSignal): boolean {
  if (signal.aborted) return true;
  if (typeof error !== "object" || error === null || !("name" in error)) return false;
  return error.name === "AbortError" || error.name === "TimeoutError";
}

async function cuerpoJson(response: Response, httpStatus: number): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new PeyClientError("PEY_FORMA_INESPERADA", { httpStatus });
  }
}

function esErrorPey(error: unknown): error is PeyClientError {
  return error instanceof PeyClientError;
}

export function crearClientePey(opciones: PeyClienteOpciones): PeyPuerto {
  if (opciones.modo !== "live") throw new PeyClientError("MODO_INVALIDO");
  if (typeof opciones.apiKey !== "string" || opciones.apiKey.length === 0 || opciones.apiKey.length > 4096 || /[\u0000-\u001f\u007f]/.test(opciones.apiKey))
    throw new PeyClientError("PEY_ARGUMENTO_INVALIDO");
  if (typeof opciones.fetch !== "function") throw new PeyClientError("PEY_ARGUMENTO_INVALIDO");
  const bankAccountId = argumentoValido(() => validarUlid(opciones.bankAccountId));

  async function solicitar(path: string, method: "GET" | "POST", body?: unknown): Promise<Response> {
    const controller = new AbortController();
    const url = `${BASE_URL}${path}`;
    const headers = new Headers({ Authorization: `Bearer ${opciones.apiKey}` });
    if (body !== undefined) headers.set("Content-Type", "application/json");

    let timer: ReturnType<typeof setTimeout> | undefined;
    const respuestaTimeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new PeyClientError("PEY_TIMEOUT"));
      }, TIMEOUT_MS);
    });
    try {
      const respuesta = await Promise.race([
        opciones.fetch(url, {
          method,
          headers,
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          redirect: "error",
          signal: controller.signal,
        }),
        respuestaTimeout,
      ]);
      return respuesta;
    } catch (error) {
      if (esErrorPey(error)) throw error;
      if (timeout(error, controller.signal)) throw new PeyClientError("PEY_TIMEOUT");
      throw new PeyClientError("PEY_RED");
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }

  async function getJson<T>(path: string, parse: (body: unknown) => T): Promise<T> {
    for (let intento = 0; intento <= GET_RETRIES; intento += 1) {
      let response: Response;
      try {
        response = await solicitar(path, "GET");
      } catch (error) {
        if (esErrorPey(error) && error.codigo === "PEY_TIMEOUT" && intento < GET_RETRIES) {
          await esperar(GET_RETRY_DELAYS_MS[intento]);
          continue;
        }
        throw error;
      }

      if (response.status === 429) {
        const info = normalizarError(await cuerpoJson(response, response.status).catch(() => null));
        throw new PeyClientError("PEY_RATE_LIMIT", { httpStatus: 429, requestId: info.requestId });
      }
      if (response.status >= 500) {
        if (intento < GET_RETRIES) {
          await esperar(GET_RETRY_DELAYS_MS[intento]);
          continue;
        }
        const info = normalizarError(await cuerpoJson(response, response.status).catch(() => null));
        throw new PeyClientError("PEY_HTTP", { httpStatus: response.status, requestId: info.requestId });
      }
      if (response.status !== 200) {
        const info = normalizarError(await cuerpoJson(response, response.status).catch(() => null));
        throw new PeyClientError("PEY_HTTP", { httpStatus: response.status, requestId: info.requestId });
      }

      const body = await cuerpoJson(response, response.status);
      try {
        return parse(body);
      } catch {
        throw new PeyClientError("PEY_FORMA_INESPERADA", { httpStatus: response.status });
      }
    }
    throw new PeyClientError("PEY_HTTP");
  }

  async function crearQr(evento: Parameters<PeyPuerto["crearQr"]>[0]): Promise<ResultadoCrear> {
    const intentoPublicId = argumentoValido(() => validarPayvroId(evento.intentoPublicId, "int"));
    const cobroPublicId = argumentoValido(() => validarPayvroId(evento.cobroPublicId, "cob"));
    if (!Number.isSafeInteger(evento.montoCentavos) || evento.montoCentavos < 1) throw new RangeError("MONTO_INVALIDO");
    if (!Number.isSafeInteger(evento.expiraSeg) || evento.expiraSeg < 360) throw new RangeError("EXPIRACION_INVALIDA");
    if (typeof evento.concepto !== "string" || evento.concepto.length < 1 || evento.concepto.length > 140 || /[\u0000-\u001f\u007f]/.test(evento.concepto))
      throw new PeyClientError("PEY_ARGUMENTO_INVALIDO");
    if (typeof evento.numRef !== "string" || !/^[0-9]{1,7}$/.test(evento.numRef)) throw new PeyClientError("PEY_ARGUMENTO_INVALIDO");

    const requestBody = {
      amount: aPesos(evento.montoCentavos),
      concept: evento.concepto,
      expiration: evento.expiraSeg,
      generateImage: false,
      bankAccountId,
      numRef: evento.numRef,
      metadata: { payvro_cobro: cobroPublicId, payvro_intento: intentoPublicId, payvro_modo: "live" },
    };

    let response: Response;
    try {
      response = await solicitar("/codi/qr", "POST", requestBody);
    } catch (error) {
      return { tipo: "incierto", causa: esErrorPey(error) && error.codigo === "PEY_TIMEOUT" ? "timeout" : "red" };
    }
    if (response.status === 429) {
      // The dispatch outcome is not safe to retry; leave the attempt uncertain.
      return { tipo: "incierto", causa: "5xx" };
    }
    if (response.status >= 400 && response.status < 500) {
      const info = normalizarError(await cuerpoJson(response, response.status).catch(() => null));
      return { tipo: "rechazado", httpStatus: response.status, errorType: info.errorType ?? "PEY_RECHAZADO", ...(info.requestId ? { requestId: info.requestId } : {}) };
    }
    if (response.status >= 500) return { tipo: "incierto", causa: "5xx" };
    if (response.status !== 201) return { tipo: "incierto", causa: "red" };

    try {
      const parsed = normalizarRespuestaQr(await cuerpoJson(response, response.status));
      return { tipo: "creado", peyPayableId: parsed.id, qrString: parsed.qrString };
    } catch {
      return { tipo: "incierto", causa: "red" };
    }
  }

  async function leerTransaccion(id: string): Promise<TransaccionPey> {
    const transactionId = argumentoValido(() => validarUlid(id));
    return getJson(`/transaction/${encodeURIComponent(transactionId)}`, (body) => {
      const transaction = normalizarTransaccionPey(body);
      if (transaction.transactionId !== transactionId) throw new TypeError("PEY_FORMA_INESPERADA");
      return transaction;
    });
  }

  async function listarTransaccionesQr(id: string, nextToken?: string) {
    const qrId = argumentoValido(() => validarQrId(id));
    const query = queryToken(nextToken);
    return getJson(`/transaction/codi/qr/${encodeURIComponent(qrId)}${query}`, normalizarPaginaReferencias);
  }

  async function listarTransaccionesCuenta(nextToken?: string): Promise<PaginaTransacciones> {
    const query = queryToken(nextToken);
    return getJson(`/transaction/bank-account/${encodeURIComponent(bankAccountId)}${query}`, normalizarPaginaTransacciones);
  }

  function queryToken(nextToken?: string): string {
    if (nextToken === undefined) return "";
    if (typeof nextToken !== "string" || nextToken.length === 0 || nextToken.length > 4096 || /[\u0000-\u001f\u007f]/.test(nextToken))
      throw new PeyClientError("PEY_ARGUMENTO_INVALIDO");
    return `?${new URLSearchParams({ nextToken }).toString()}`;
  }

  function capacidadNoDisponible(): never {
    throw new PeyClientError("PEY_CAPACIDAD_NO_DISPONIBLE");
  }

  const cliente: PeyPuerto = {
    crearQr,
    crearLink: async () => capacidadNoDisponible(),
    leerLink: async (_id: string): Promise<EvidenciaLink> => capacidadNoDisponible(),
    leerTransaccion,
    listarTransaccionesQr,
    listarTransacciones: async (_nextToken?: string): Promise<PaginaTransacciones> => capacidadNoDisponible(),
    listarTransaccionesCuenta,
    leerCuenta: async () => getJson(`/bank-account/${encodeURIComponent(bankAccountId)}`, (body) => normalizarCuenta(body, bankAccountId)),
  };
  return cliente;
}
