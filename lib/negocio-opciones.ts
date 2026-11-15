export const GIROS = [
  { valor: "social", etiqueta: "Social" },
  { valor: "citas", etiqueta: "Citas" },
  { valor: "cotizaciones", etiqueta: "Cotizaciones" },
  { valor: "mostrador", etiqueta: "Mostrador" },
  { valor: "membresias", etiqueta: "Membresías" },
  { valor: "tienda", etiqueta: "Tienda" },
] as const;

export type Giro = (typeof GIROS)[number]["valor"];

export const COLORES_MARCA = ["#076B76", "#EF006D", "#FF7900", "#142B3B"] as const;

export type ColorMarca = (typeof COLORES_MARCA)[number];

export function esGiro(valor: string): valor is Giro {
  return GIROS.some((giro) => giro.valor === valor);
}

export function esColorMarca(valor: string): valor is ColorMarca {
  return (COLORES_MARCA as readonly string[]).includes(valor);
}
