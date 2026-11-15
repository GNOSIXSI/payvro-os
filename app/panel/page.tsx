"use client";

import { useQuery } from "convex/react";
import { ConfiguraConvex } from "@/components/configura-convex";
import { GraficaIngresos } from "@/components/grafica-ingresos";
import { TablaCobros, type CobroLista } from "@/components/tabla-cobros";
import { TarjetaResumen } from "@/components/tarjeta-resumen";
import { Monto } from "@/components/monto";
import { api } from "@/convex/_generated/api";
import { serieIngresos } from "@/lib/serie";
import { esEstadoCobro } from "@/lib/estados";
import { HAY_CONVEX } from "@/lib/hay-convex";

export default function PanelPage() {
  const resumenRemoto = useQuery(api.cobros.resumenDelDia, HAY_CONVEX ? {} : "skip");
  const listaRemota = useQuery(
    api.cobros.listar,
    HAY_CONVEX ? { paginationOpts: { numItems: 50, cursor: null } } : "skip",
  );

  if (!HAY_CONVEX) {
    return <ConfiguraConvex />;
  }
  if (resumenRemoto === undefined || listaRemota === undefined) {
    return <p className="text-muted">Cargando cobros…</p>;
  }

  const cobros = cobrosDePagina(listaRemota.page);

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <h1 className="font-display text-3xl font-semibold text-ink">Inicio</h1>
      <section className="grid gap-3 sm:grid-cols-3">
        <TarjetaResumen titulo="Cobrado hoy" valor={<Monto centavos={resumenRemoto.verificadoHoyCentavos} />} />
        <TarjetaResumen titulo="Por liberar" valor={resumenRemoto.porLiberar} />
        <TarjetaResumen titulo="En revisión" valor={resumenRemoto.enRevision} />
      </section>
      <GraficaIngresos serie={serieIngresos(cobros)} />
      <section id="cobros" className="flex min-w-0 flex-col gap-4">
        <h2 className="font-display text-xl font-semibold text-ink">Cobros recientes</h2>
        <TablaCobros cobros={cobros} />
      </section>
    </div>
  );
}

function cobrosDePagina(page: Array<{
  publicId: string;
  folio: number;
  concepto: string;
  montoCentavos: number;
  estado: string;
  alerta?: "pago_duplicado";
  creadoEn: number;
}>): CobroLista[] {
  const filas: CobroLista[] = [];
  for (const fila of page) {
    if (!esEstadoCobro(fila.estado)) {
      continue;
    }
    filas.push({
      publicId: fila.publicId,
      folio: fila.folio,
      concepto: fila.concepto,
      montoCentavos: fila.montoCentavos,
      estado: fila.estado,
      alerta: fila.alerta,
      creadoEn: fila.creadoEn,
    });
  }
  return filas;
}
