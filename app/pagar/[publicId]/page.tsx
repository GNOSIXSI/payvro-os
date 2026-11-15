"use client";

import { useQuery } from "convex/react";
import { useParams } from "next/navigation";
import { ConfiguraConvex } from "@/components/configura-convex";
import { PagarAusente, PagarVista } from "@/components/pagar-vista";
import { api } from "@/convex/_generated/api";
import { HAY_CONVEX } from "@/lib/hay-convex";
import { useSondeo } from "@/lib/sondeo";

export default function PagarPage() {
  const params = useParams<{ publicId: string }>();
  const publicId = params.publicId;
  const remoto = useQuery(api.publico.cobro, HAY_CONVEX && publicId ? { publicId } : "skip");
  const espera = remoto?.estadoVisible === "Esperando pago";
  useSondeo(publicId, espera);

  if (!HAY_CONVEX) {
    return <ConfiguraConvex />;
  }
  if (remoto === undefined) {
    return <p className="px-6 py-12 text-muted">Cargando cobro…</p>;
  }
  if (!remoto || !publicId) {
    return <PagarAusente />;
  }
  return <PagarVista cobro={remoto} publicId={publicId} />;
}
