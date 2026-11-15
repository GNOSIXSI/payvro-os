import { cobroListaPorId, QR_DEMO } from "./demo-fixtures";
import type { CobroLista } from "./demo-fixtures";

const DIA_MS = 24 * 60 * 60 * 1000;

function intentoDe(cobro: CobroLista) {
  const espera = cobro.estado === "esperando_pago" || cobro.estado === "borrador";
  return {
    publicId: `int_${String(cobro.folio).padStart(26, "0")}`,
    tipo: "qr" as const,
    estado: espera ? (cobro.estado === "borrador" ? ("reservado" as const) : ("creado" as const)) : ("pagado" as const),
    montoCentavos: cobro.montoCentavos,
    qrString: cobro.estado === "esperando_pago" ? QR_DEMO : undefined,
  };
}

function pagoDe(cobro: CobroLista) {
  if (
    cobro.estado !== "pagado_verificado" &&
    cobro.estado !== "liberado" &&
    cobro.estado !== "en_revision"
  ) {
    return null;
  }
  return {
    publicId: `pag_${String(cobro.folio).padStart(26, "0")}`,
    resultado: cobro.estado === "en_revision" ? ("duplicado" as const) : ("coincide" as const),
    metodo: "CODI" as const,
    baseCentavos: cobro.montoCentavos,
    totalCentavos: cobro.montoCentavos,
    pagadoEn: cobro.creadoEn,
  };
}

export function cobroDetalleDemo(publicId: string) {
  const cobro = cobroListaPorId(publicId);
  if (!cobro) {
    return null;
  }
  return {
    ...cobro,
    expiraEn: cobro.creadoEn + DIA_MS,
    intentoActivo: intentoDe(cobro),
    pago: pagoDe(cobro),
  };
}
