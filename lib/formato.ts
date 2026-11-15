const MXN = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

export function formatoMXN(centavos: number): string {
  if (!Number.isSafeInteger(centavos)) {
    throw new RangeError("MONTO_INVALIDO");
  }

  const signo = centavos < 0 ? -1 : 1;
  const absoluto = Math.abs(centavos);
  const pesosEnteros = Math.trunc(absoluto / 100);
  const residuo = absoluto % 100;
  const texto = `${pesosEnteros}.${String(residuo).padStart(2, "0")}`;

  return MXN.format(signo * Number(texto));
}

export function pesosACentavos(texto: string): number {
  const recortado = texto.trim();
  if (recortado === "") {
    throw new RangeError("MONTO_INVALIDO");
  }
  if (/[eE+\-]/.test(recortado) || /[^0-9.,]/.test(recortado)) {
    throw new RangeError("MONTO_INVALIDO");
  }
  if (!/^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?$/.test(recortado)) {
    throw new RangeError("MONTO_INVALIDO");
  }

  const [enterosCrudos, decimalesCrudos = ""] = recortado.replace(/,/g, "").split(".");
  const enteros = enterosCrudos ?? "0";
  const decimales = decimalesCrudos.padEnd(2, "0");
  const digitos = `${enteros}${decimales}`;

  let centavos = 0;
  for (const caracter of digitos) {
    centavos = centavos * 10 + (caracter.charCodeAt(0) - 48);
    if (!Number.isSafeInteger(centavos)) {
      throw new RangeError("MONTO_INVALIDO");
    }
  }

  if (centavos < 1) {
    throw new RangeError("MONTO_INVALIDO");
  }

  return centavos;
}
