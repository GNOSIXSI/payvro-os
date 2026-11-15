"use client";

import { useQuery } from "convex/react";
import { FormaAjustes } from "@/components/forma-ajustes";
import { api } from "@/convex/_generated/api";
import { NEGOCIO_DEMO } from "@/lib/demo-fixtures";
import { HAY_CONVEX } from "@/lib/hay-convex";

export default function AjustesPage() {
  const remoto = useQuery(api.negocio.obtener, HAY_CONVEX ? {} : "skip");
  const negocio = HAY_CONVEX ? remoto : NEGOCIO_DEMO;

  if (HAY_CONVEX && remoto === undefined) {
    return <p className="text-muted">Cargando ajustes…</p>;
  }
  if (!negocio) {
    return <p className="text-ink">No se pudo cargar el negocio.</p>;
  }
  return <FormaAjustes key={negocio.nombre} negocio={negocio} />;
}
