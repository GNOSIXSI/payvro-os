"use client";

import { useQuery } from "convex/react";
import { GraficaIngresos } from "@/components/grafica-ingresos";
import { TablaCobros } from "@/components/tabla-cobros";
import { TarjetaResumen } from "@/components/tarjeta-resumen";
import { Monto } from "@/components/monto";
import { api } from "@/convex/_generated/api";
import { serieIngresos } from "@/lib/serie";
import { COBROS_DEMO, RESUMEN_DEMO } from "@/lib/demo-fixtures";
import type { CobroLista } from "@/lib/demo-fixtures";
import { esEstadoCobro } from "@/lib/estados";
import { HAY_CONVEX } from "@/lib/hay-convex";

export default function PanelPage() {
  const resumenRemoto = useQuery(api.cobros.resumenDelDia, HAY_CONVEX ? {} : "skip");
  const listaRemota = useQuery(
    api.cobros.listar,
    HAY_CONVEX ? { paginationOpts: { numItems: 50, cursor: null } } : "skip",
  );

  const resumen = HAY_CONVEX ? resumenRemoto : RESUMEN_DEMO;
  const cobros = HAY_CONVEX ? cobrosDePagina(listaRemota?.page) : COBROS_DEMO;
  const cargando = HAY_CONVEX && (resumen === undefined || listaRemota === undefined);

  if (cargando) {
    return <p className="text-muted">Cargando cobros…</p>;
  }

  if (!resumen || !cobros) {
    return <p className="text-muted">No se pudieron cargar los cobros.</p>;
  }

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <h1 className="font-display text-3xl font-semibold text-ink">Inicio</h1>
      <section className="grid gap-3 sm:grid-cols-3">
        <TarjetaResumen titulo="Cobrado hoy" valor={<Monto centavos={resumen.verificadoHoyCentavos} />} />
        <TarjetaResumen titulo="Por liberar" valor={resumen.porLiberar} />
        <TarjetaResumen titulo="En revisión" valor={resumen.enRevision} />
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
}> | undefined): CobroLista[] | undefined {
  if (!page) {
    return undefined;
  }
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
