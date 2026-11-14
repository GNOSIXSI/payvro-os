export const NEGOCIO_FIXTURE = {
  nombre: "Dulces Ana — Ejemplo",
  giro: "tienda",
  colorMarca: "#076B76",
  modo: "demo",
  cobrosPausados: false,
  cuentaLista: false,
} as const;

export const COBROS_FIXTURE = [
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
] as const;

export const RESUMEN_FIXTURE = {
  verificadoHoyCentavos: 63_700,
  porLiberar: 1,
  enRevision: 1,
} as const;

export const QR_STRING_FIXTURE = "PAYVRO-DEMO-QR-NOT-A-REAL-PAYMENT";

export const BITACORA_FIXTURE = [
  {
    publicId: "bit_00000000000000000000000000",
    seq: 104,
    tipo: "cobro.creado",
    cobroPublicId: COBROS_FIXTURE[0].publicId,
    actor: { tipo: "sistema" },
    estadoDespues: "esperando_pago",
    detalle: {},
    en: 1_794_672_000_000,
  },
  {
    publicId: "bit_11111111111111111111111111",
    seq: 103,
    tipo: "cobro.creado",
    cobroPublicId: COBROS_FIXTURE[1].publicId,
    actor: { tipo: "sistema" },
    estadoDespues: "pagado_verificado",
    detalle: {},
    en: 1_794_585_600_000,
  },
  {
    publicId: "bit_22222222222222222222222222",
    seq: 102,
    tipo: "cobro.creado",
    cobroPublicId: COBROS_FIXTURE[2].publicId,
    actor: { tipo: "sistema" },
    estadoDespues: "liberado",
    detalle: {},
    en: 1_794_499_200_000,
  },
  {
    publicId: "bit_33333333333333333333333333",
    seq: 101,
    tipo: "cobro.creado",
    cobroPublicId: COBROS_FIXTURE[3].publicId,
    actor: { tipo: "sistema" },
    estadoDespues: "en_revision",
    detalle: {},
    en: 1_794_412_800_000,
  },
] as const;
