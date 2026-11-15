"use client";

import { useQuery } from "convex/react";
import { useParams } from "next/navigation";
import { PagarAusente, PagarVista } from "@/components/pagar-vista";
import { api } from "@/convex/_generated/api";
import { cobroPublicoDemo } from "@/lib/demo-fixtures";
import { HAY_CONVEX } from "@/lib/hay-convex";
import { useSondeo } from "@/lib/sondeo";

export default function PagarPage() {
  const params = useParams<{ publicId: string }>();
  const publicId = params.publicId;
  const remoto = useQuery(api.publico.cobro, HAY_CONVEX && publicId ? { publicId } : "skip");
  const local = publicId ? cobroPublicoDemo(publicId) : null;
  const cobro = HAY_CONVEX ? remoto : local;
  const espera = cobro?.estadoVisible === "Esperando pago";
  useSondeo(publicId, espera);

  if (HAY_CONVEX && remoto === undefined) {
    return <p className="px-6 py-12 text-muted">Cargando cobro…</p>;
  }
  if (!cobro || !publicId) {
    return <PagarAusente />;
  }
  return <PagarVista cobro={cobro} publicId={publicId} />;
}
