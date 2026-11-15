import { describe, expect, it, vi } from "vitest";
import qrCreado from "./formas/qr-creado.json";
import qrTransacciones from "./formas/qr-transacciones.json";
import cuenta from "./formas/cuenta.json";
import transaccion from "./formas/transaccion.json";
import transaccionesCuenta from "./formas/transacciones-cuenta.json";
import { crearClientePey } from "../../packages/engine/src/pey/cliente";

const BANK_ID = "01XXXXXXXXXXXXXXXXXXXXXXXX";
const QR_ID = "AB12CD34EF";
const TX_ID = "01XXXXXXXXXXXXXXXXXXXXXXXX";
const crearEvento = {
  intentoPublicId: "int_example",
  cobroPublicId: "cob_example",
  montoCentavos: 1,
  concepto: "Pedido de ejemplo",
  expiraSeg: 86400,
  numRef: "1",
};

type Respuesta = { status: number; body: unknown } | Error;
function fetchFalso(respuestas: Respuesta[]) {
  const llamadas: Array<{ url: string; init: RequestInit }> = [];
  const fetcher: typeof globalThis.fetch = async (input, init = {}) => {
    llamadas.push({ url: String(input), init });
    const respuesta = respuestas.shift();
    if (respuesta instanceof Error) throw respuesta;
    if (!respuesta) throw new Error("unexpected fetch");
    return new Response(JSON.stringify(respuesta.body), { status: respuesta.status });
  };
  return { fetcher, llamadas };
}
function cliente(respuestas: Respuesta[]) {
  const falso = fetchFalso(respuestas);
  return { ...falso, pey: crearClientePey({ apiKey: "key-sentinel-never-in-errors", bankAccountId: BANK_ID, fetch: falso.fetcher, modo: "live" }) };
}

describe("LIVE pey QR client", () => {
  it("converts one centavo and sends only the fixed QR request fields", async () => {
    const { pey, llamadas } = cliente([{ status: 201, body: qrCreado }]);
    const resultado = await pey.crearQr(crearEvento);
    expect(resultado).toEqual({ tipo: "creado", peyPayableId: QR_ID, qrString: qrCreado.qrString });
    expect(JSON.parse(String(llamadas[0].init.body))).toEqual({
      amount: 0.01,
      concept: "Pedido de ejemplo",
      expiration: 86400,
      generateImage: false,
      bankAccountId: BANK_ID,
      numRef: "1",
      metadata: { payvro_cobro: "cob_example", payvro_intento: "int_example", payvro_modo: "live" },
    });
    expect(llamadas[0].url).toBe("https://api.pey.mx/codi/qr");
    expect(llamadas[0].init).toMatchObject({ method: "POST", redirect: "error" });
    expect((llamadas[0].init.headers as Headers).get("authorization")).toBe("Bearer key-sentinel-never-in-errors");
    expect(llamadas[0].init.signal).toBeInstanceOf(AbortSignal);
  });

  it("rejects a zero amount before making a request", async () => {
    const { pey, llamadas } = cliente([]);
    await expect(pey.crearQr({ ...crearEvento, montoCentavos: 0 })).rejects.toThrow("MONTO_INVALIDO");
    expect(llamadas).toHaveLength(0);
  });

  it("validates the 201 response before returning created", async () => {
    for (const body of [{ qrString: "not-an-id" }, { id: QR_ID }, { id: "../outside", qrString: "payload" }]) {
      const { pey, llamadas } = cliente([{ status: 201, body }]);
      await expect(pey.crearQr(crearEvento)).resolves.toMatchObject({ tipo: "incierto" });
      expect(llamadas).toHaveLength(1);
    }
  });

  it("maps a definite non-rate-limit 4xx to rejected without exposing provider prose", async () => {
    const { pey, llamadas } = cliente([{ status: 400, body: { error: { message: "private provider text", type: "INVALID_AMOUNT", requestId: "req-example" } } }]);
    await expect(pey.crearQr(crearEvento)).resolves.toEqual({ tipo: "rechazado", httpStatus: 400, errorType: "INVALID_AMOUNT", requestId: "req-example" });
    expect(llamadas).toHaveLength(1);
  });

  it("treats POST 429 as uncertain without retrying the charge", async () => {
    const { pey, llamadas } = cliente([{ status: 429, body: { error: { message: "slow down", type: "RATE_LIMIT" } } }]);
    await expect(pey.crearQr(crearEvento)).resolves.toMatchObject({ tipo: "incierto" });
    expect(llamadas).toHaveLength(1);
  });

  it("aborts a dispatched request after ten seconds without retrying it", async () => {
    const llamadas: Array<{ signal: AbortSignal }> = [];
    const fetcher: typeof globalThis.fetch = async (_input, init = {}) => {
      const signal = init.signal as AbortSignal;
      llamadas.push({ signal });
      return new Promise<Response>((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
      });
    };
    const pey = crearClientePey({ apiKey: "sentinel", bankAccountId: BANK_ID, fetch: fetcher, modo: "live" });
    vi.useFakeTimers();
    try {
      const pending = pey.crearQr(crearEvento);
      await vi.advanceTimersByTimeAsync(10_000);
      await expect(pending).resolves.toEqual({ tipo: "incierto", causa: "timeout" });
      expect(llamadas).toHaveLength(1);
      expect(llamadas[0].signal.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("treats timeout, 5xx and malformed success as uncertain and never retries the POST", async () => {
    const cases: Respuesta[][] = [
      [new DOMException("timed out", "AbortError")],
      [{ status: 500, body: { error: { message: "provider detail" } } }],
      [{ status: 201, body: { id: QR_ID, qrString: 42 } }],
    ];
    for (const respuestas of cases) {
      const { pey, llamadas } = cliente(respuestas);
      await expect(pey.crearQr(crearEvento)).resolves.toMatchObject({ tipo: "incierto" });
      expect(llamadas).toHaveLength(1);
    }
  });

  it("rejects path traversal and encoding tricks before any fetch", async () => {
    for (const malicious of ["../outside", "%2e%2e", "id/other", "id?x=1", "id#frag", "id@host", "id%2fother", "id\\\\other"]) {
      const { pey, llamadas } = cliente([]);
      await expect(pey.listarTransaccionesQr(malicious)).rejects.toThrow();
      expect(llamadas).toHaveLength(0);
    }
    expect(() => crearClientePey({ apiKey: "sentinel", bankAccountId: "../account", fetch: fetchFalso([]).fetcher, modo: "live" })).toThrow();
  });

  it("normalizes QR listing entries as references and preserves a null nextToken", async () => {
    const { pey, llamadas } = cliente([{ status: 200, body: qrTransacciones }]);
    const pagina = await pey.listarTransaccionesQr(QR_ID);
    expect(pagina).toEqual({ transactions: [{ transactionId: TX_ID }], nextToken: null });
    expect(llamadas[0].url).toBe(`https://api.pey.mx/transaction/codi/qr/${QR_ID}`);
  });

  it("normalizes wire IDs, epoch seconds and external metadata while stripping payer banking data", async () => {
    const { pey } = cliente([{ status: 200, body: transaccion }]);
    const resultado = await pey.leerTransaccion(TX_ID);
    expect(resultado).toEqual({
      transactionId: TX_ID,
      status: "PAID",
      amount: 1.01,
      amountBreakdown: { base: 1, tip: 0.01, fee: 0 },
      currency: "MXN",
      paymentMethod: "CODI",
      payableType: "API_CODI_QR",
      payableId: QR_ID,
      dateCreated: "2024-01-01T00:00:00.000Z",
      datePaid: "2024-01-01T00:01:00.000Z",
      metadata: { trackingKey: "TRACKING-EXAMPLE", payvro_cobro: "cob_example", payvro_intento: "int_example", payvro_modo: "live" },
    });
    expect(JSON.stringify(resultado)).not.toMatch(/clabe|bankCode|accountType|customerEmail|applicationFee/i);
  });

  it("rejects missing evidence fields instead of inferring payment truth", async () => {
    const invalid = [
      { ...transaccion, amountBreakdown: { tip: 0, fee: 0 } },
      { ...transaccion, currency: undefined },
      { ...transaccion, datePaid: undefined },
      { ...transaccion, payableId: undefined },
      { ...transaccion, id: undefined },
      { ...transaccion, status: "SETTLED" },
    ];
    for (const body of invalid) {
      const { pey } = cliente([{ status: 200, body }]);
      await expect(pey.leerTransaccion(TX_ID)).rejects.toMatchObject({ codigo: "PEY_FORMA_INESPERADA" });
    }
  });

  it("drops non-string untrusted external metadata but rejects non-string PAYVRO correlation ids", async () => {
    const { pey } = cliente([{ status: 200, body: transaccion }]);
    await expect(pey.leerTransaccion(TX_ID)).resolves.toMatchObject({
      metadata: { payvro_cobro: "cob_example", payvro_intento: "int_example", payvro_modo: "live" },
    });
    const invalid = {
      ...transaccion,
      metadata: { ...transaccion.metadata, externalMetadata: { payvro_intento: 42 } },
    };
    const malformed = cliente([{ status: 200, body: invalid }]);
    await expect(malformed.pey.leerTransaccion(TX_ID)).rejects.toMatchObject({ codigo: "PEY_FORMA_INESPERADA" });
  });

  it("defaults only absent zero tip and fee components", async () => {
    const { pey } = cliente([{ status: 200, body: { ...transaccion, amount: 1, amountBreakdown: { base: 1 }, metadata: undefined } }]);
    await expect(pey.leerTransaccion(TX_ID)).resolves.toMatchObject({ amountBreakdown: { base: 1, tip: 0, fee: 0 } });
  });

  it("uses the configured bank account and returns only codiStatus", async () => {
    const { pey, llamadas } = cliente([{ status: 200, body: cuenta }]);
    await expect(pey.leerCuenta()).resolves.toEqual({ codiStatus: "ACTIVE" });
    expect(llamadas[0].url).toBe(`https://api.pey.mx/bank-account/${BANK_ID}`);
  });

  it("fails closed if the account response identifies a different account", async () => {
    const { pey, llamadas } = cliente([{ status: 200, body: { ...cuenta, id: "01YYYYYYYYYYYYYYYYYYYYYYYY" } }]);
    await expect(pey.leerCuenta()).rejects.toMatchObject({ codigo: "PEY_FORMA_INESPERADA" });
    expect(llamadas).toHaveLength(1);
  });

  it("reads configured-account transactions, skips unknown payable shapes, and encodes opaque tokens", async () => {
    const { pey, llamadas } = cliente([{ status: 200, body: transaccionesCuenta }]);
    const pagina = await pey.listarTransaccionesCuenta("token&nextToken=evil/#?");
    expect(pagina.transactions).toHaveLength(1);
    expect(pagina.transactions[0]).toMatchObject({ transactionId: TX_ID, payableId: QR_ID, payableType: "API_CODI_QR" });
    expect(pagina.nextToken).toBeNull();
    const url = new URL(llamadas[0].url);
    expect(url.origin + url.pathname).toBe(`https://api.pey.mx/transaction/bank-account/${BANK_ID}`);
    expect(url.searchParams.get("nextToken")).toBe("token&nextToken=evil/#?");
    expect([...url.searchParams.keys()]).toEqual(["nextToken"]);
  });

  it("retries GET timeout/5xx at most twice but surfaces 429 for scheduler backoff", async () => {
    const retried = cliente([
      { status: 503, body: {} },
      { status: 502, body: {} },
      { status: 200, body: transaccion },
    ]);
    await expect(retried.pey.leerTransaccion(TX_ID)).resolves.toMatchObject({ status: "PAID" });
    expect(retried.llamadas).toHaveLength(3);

    const timedOut = cliente([
      new DOMException("timed out", "AbortError"),
      new DOMException("timed out", "AbortError"),
      { status: 200, body: transaccion },
    ]);
    await expect(timedOut.pey.leerTransaccion(TX_ID)).resolves.toMatchObject({ status: "PAID" });
    expect(timedOut.llamadas).toHaveLength(3);

    const exhausted = cliente([
      { status: 503, body: {} },
      { status: 502, body: {} },
      { status: 500, body: {} },
      { status: 200, body: transaccion },
    ]);
    await expect(exhausted.pey.leerTransaccion(TX_ID)).rejects.toMatchObject({ httpStatus: 500 });
    expect(exhausted.llamadas).toHaveLength(3);

    const limited = cliente([{ status: 429, body: {} }]);
    await expect(limited.pey.leerTransaccion(TX_ID)).rejects.toMatchObject({ httpStatus: 429 });
    expect(limited.llamadas).toHaveLength(1);
  });

  it("fails closed for unsupported LIVE link and API-key-wide operations", async () => {
    const { pey, llamadas } = cliente([]);
    await expect(pey.crearLink({ intentoPublicId: "int_example", cobroPublicId: "cob_example", montoCentavos: 1, successUrl: "https://example.invalid/s", backUrl: "https://example.invalid/b" })).rejects.toThrow("PEY_CAPACIDAD_NO_DISPONIBLE");
    await expect(pey.leerLink("01XXXXXXXXXXXXXXXXXXXXXXXX")).rejects.toThrow("PEY_CAPACIDAD_NO_DISPONIBLE");
    await expect(pey.listarTransacciones()).rejects.toThrow("PEY_CAPACIDAD_NO_DISPONIBLE");
    expect(llamadas).toHaveLength(0);
  });

  it("refuses construction outside LIVE mode and never leaks the key through POST or GET errors", async () => {
    expect(() => crearClientePey({ apiKey: "sentinel-secret", bankAccountId: BANK_ID, fetch: fetchFalso([]).fetcher, modo: "demo" })).toThrow("MODO_INVALIDO");
    const post = cliente([new Error("network failed for key-sentinel-never-in-errors")]);
    await expect(post.pey.crearQr(crearEvento)).resolves.toMatchObject({ tipo: "incierto", causa: "red" });
    const get = cliente([new Error("network failed for key-sentinel-never-in-errors")]);
    const error = await get.pey.leerTransaccion(TX_ID).then(() => null, (failure: unknown) => failure);
    expect(String(error)).not.toContain("key-sentinel-never-in-errors");
    expect(get.llamadas).toHaveLength(1);
  });
});
