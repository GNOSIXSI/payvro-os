export const MONTO_MIN_CENTAVOS = 1;
export const MONTO_MAX_CENTAVOS = 100_000_000;

function montoInvalido(): never {
  throw new RangeError("MONTO_INVALIDO");
}

export function aCentavos(pesos: number): number {
  if (!Number.isFinite(pesos) || pesos <= 0) {
    return montoInvalido();
  }

  const centavos = Math.round(pesos * 100);
  const diferencia = Math.abs(pesos * 100 - centavos);

  if (
    diferencia > 1e-6 ||
    !Number.isSafeInteger(centavos) ||
    centavos < MONTO_MIN_CENTAVOS ||
    centavos > MONTO_MAX_CENTAVOS
  ) {
    return montoInvalido();
  }

  return centavos;
}

export function aPesos(centavos: number): number {
  if (
    !Number.isSafeInteger(centavos) ||
    centavos < MONTO_MIN_CENTAVOS ||
    centavos > MONTO_MAX_CENTAVOS
  ) {
    return montoInvalido();
  }

  return centavos / 100;
}
