"use client";

import { useQuery } from "convex/react";
import { useParams } from "next/navigation";
import { ConfiguraConvex } from "@/components/configura-convex";
import { DetalleCobro, type DetalleCobroDatos } from "@/components/detalle-cobro";
import type { EntradaBitacora } from "@/components/linea-de-tiempo";
import { api } from "@/convex/_generated/api";
import { esEstadoCobro } from "@/lib/estados";
import { HAY_CONVEX } from "@/lib/hay-convex";
import { useSondeo } from "@/lib/sondeo";

export default function CobroDetallePage() {
  const { publicId } = useParams<{ publicId: string }>();
  const remoto = useQuery(api.cobros.obtener, HAY_CONVEX && publicId ? { publicId } : "skip");
  const bitacoraRemota = useQuery(
    api.panel.bitacora,
    HAY_CONVEX && publicId
      ? { cobroPublicId: publicId, paginationOpts: { numItems: 50, cursor: null } }
      : "skip",
  );
  const cobro = detalleDeRemoto(remoto);
  const espera = cobro?.estado === "esperando_pago";
  useSondeo(publicId, espera);

  if (!HAY_CONVEX) {
    return <ConfiguraConvex />;
  }
  if (remoto === undefined || bitacoraRemota === undefined) {
    return <p className="text-muted">Cargando cobro…</p>;
  }
  if (!cobro) {
    return <p className="text-ink">Este cobro no existe o ya no está disponible.</p>;
  }
  return <DetalleCobro cobro={cobro} bitacora={entradasDe(bitacoraRemota.page)} />;
}

function entradasDe(page: Array<{ tipo: string; en: number }>): EntradaBitacora[] {
  return page.map((entrada) => ({ tipo: entrada.tipo, en: entrada.en }));
}

function detalleDeRemoto(
  remoto:
    | {
        publicId: string;
        folio: number;
        concepto: string;
        montoCentavos: number;
        estado: string;
        intentoActivo: { estado: string; qrString?: string; urlPago?: string } | null;
        pago: { resultado: string } | null;
      }
    | null
    | undefined,
): DetalleCobroDatos | null {
  if (!remoto || !esEstadoCobro(remoto.estado)) {
    return null;
  }
  return {
    publicId: remoto.publicId,
    folio: remoto.folio,
    concepto: remoto.concepto,
    montoCentavos: remoto.montoCentavos,
    estado: remoto.estado,
    intentoActivo: remoto.intentoActivo,
    pago: remoto.pago,
  };
}
