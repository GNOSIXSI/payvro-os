export const BLANCO = "#FFFFFF";
export const TINTA = "#142B3B";
export const NEGRO = "#000000";

const MINIMO = 4.5;

export function contraste(frente: string, fondo: string): number {
  const clara = Math.max(luminancia(frente), luminancia(fondo));
  const oscura = Math.min(luminancia(frente), luminancia(fondo));
  return (clara + 0.05) / (oscura + 0.05);
}

export function colorTextoMarca(fondo: string): string {
  const sobreBlanco = contraste(BLANCO, fondo);
  const sobreTinta = contraste(TINTA, fondo);
  if (sobreBlanco >= MINIMO && sobreBlanco >= sobreTinta) {
    return BLANCO;
  }
  if (sobreTinta >= MINIMO) {
    return TINTA;
  }
  return NEGRO;
}

function luminancia(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  return (
    0.2126 * canal((n >> 16) & 255) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255)
  );
}

function canal(valor: number): number {
  const c = valor / 255;
  if (c <= 0.03928) {
    return c / 12.92;
  }
  return ((c + 0.055) / 1.055) ** 2.4;
}
