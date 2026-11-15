import type { EstadoCobro } from "./estados";
import { estadoParaPagador } from "./estados";
import type { ColorMarca, Giro } from "./negocio-opciones";

export const QR_DEMO = "PAYVRO-DEMO-QR-NOT-A-REAL-PAYMENT";

export const NEGOCIO_DEMO = {
  nombre: "Dulces Ana — Ejemplo",
  giro: "tienda" as Giro,
  colorMarca: "#076B76" as ColorMarca,
  modo: "demo" as const,
  cobrosPausados: false,
  cuentaLista: false,
};

export const RESUMEN_DEMO = {
  verificadoHoyCentavos: 63_700,
  porLiberar: 1,
  enRevision: 1,
};

export type CobroLista = {
  publicId: string;
  folio: number;
  concepto: string;
  montoCentavos: number;
  estado: EstadoCobro;
  alerta?: "pago_duplicado";
  creadoEn: number;
};

export const COBROS_DEMO: readonly CobroLista[] = [
  {
    publicId: "cob_00000000000000000000000000",
    folio: 104,
    concepto: "Pedido de ejemplo",
    montoCentavos: 14_900,
    estado: "esperando_pago",
    creadoEn: 1_794_672_000_000,
  },
  {
    publicId: "cob_11111111111111111111111111",
    folio: 103,
    concepto: "Anticipo de ejemplo",
    montoCentavos: 23_800,
    estado: "pagado_verificado",
    creadoEn: 1_794_585_600_000,
  },
  {
    publicId: "cob_22222222222222222222222222",
    folio: 102,
    concepto: "Compra de ejemplo",
    montoCentavos: 39_900,
    estado: "liberado",
    alerta: "pago_duplicado",
    creadoEn: 1_794_499_200_000,
  },
  {
    publicId: "cob_33333333333333333333333333",
    folio: 101,
    concepto: "Pago por revisar",
    montoCentavos: 5_900,
    estado: "en_revision",
    creadoEn: 1_794_412_800_000,
  },
  {
    publicId: "cob_44444444444444444444444444",
    folio: 100,
    concepto: "Pedido en borrador",
    montoCentavos: 10_000,
    estado: "borrador",
    creadoEn: 1_794_326_400_000,
  },
  {
    publicId: "cob_55555555555555555555555555",
    folio: 99,
    concepto: "Pedido expirado",
    montoCentavos: 7_500,
    estado: "expirado",
    creadoEn: 1_794_240_000_000,
  },
  {
    publicId: "cob_66666666666666666666666666",
    folio: 98,
    concepto: "Pedido cancelado",
    montoCentavos: 3_200,
    estado: "cancelado",
    creadoEn: 1_794_153_600_000,
  },
];

export const BITACORA_DEMO = COBROS_DEMO.map((cobro, indice) => ({
  publicId: `bit_${String(indice).padStart(26, "0")}`,
  seq: cobro.folio,
  tipo: "cobro.creado" as const,
  cobroPublicId: cobro.publicId,
  actor: { tipo: "sistema" as const },
  estadoDespues: cobro.estado,
  detalle: {},
  en: cobro.creadoEn,
}));

export function cobroListaPorId(publicId: string): CobroLista | null {
  return COBROS_DEMO.find((cobro) => cobro.publicId === publicId) ?? null;
}

export function cobroPublicoDemo(publicId: string) {
  const cobro = cobroListaPorId(publicId);
  if (!cobro) {
    return null;
  }

  const espera = cobro.estado === "esperando_pago";
  return {
    negocio: {
      nombre: NEGOCIO_DEMO.nombre,
      colorMarca: NEGOCIO_DEMO.colorMarca,
    },
    folio: cobro.folio,
    concepto: cobro.concepto,
    montoCentavos: cobro.montoCentavos,
    estadoVisible: estadoParaPagador(cobro.estado).etiqueta,
    qrString: espera ? QR_DEMO : undefined,
    modo: NEGOCIO_DEMO.modo,
  };
}
