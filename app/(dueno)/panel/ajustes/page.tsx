"use client";

import { useQuery } from "convex/react";
import { ConfiguraConvex } from "@/components/configura-convex";
import { FormaAjustes } from "@/components/forma-ajustes";
import { api } from "@/convex/_generated/api";
import { HAY_CONVEX } from "@/lib/hay-convex";

export default function AjustesPage() {
  const remoto = useQuery(api.negocio.obtener, HAY_CONVEX ? {} : "skip");

  if (!HAY_CONVEX) {
    return <ConfiguraConvex />;
  }
  if (remoto === undefined) {
    return <p className="text-muted">Cargando ajustes…</p>;
  }
  const negocio = remoto;
  if (!negocio) {
    return <p className="text-ink">No se pudo cargar el negocio.</p>;
  }
  return <FormaAjustes key={negocio.nombre} negocio={negocio} />;
}
