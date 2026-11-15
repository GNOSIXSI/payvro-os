"use client";

import { useQuery } from "convex/react";
import { useCallback, useEffect, useState } from "react";
import { ConfiguraConvex } from "@/components/configura-convex";
import { GraficaIngresos } from "@/components/grafica-ingresos";
import { TablaCobros, type CobroLista } from "@/components/tabla-cobros";
import { TarjetaResumen } from "@/components/tarjeta-resumen";
import { Monto } from "@/components/monto";
import { api } from "@/convex/_generated/api";
import { agrupaPorCreacion, leerMarcas, rotuloIngresos, serieIngresos } from "@/lib/serie";
import { esEstadoCobro } from "@/lib/estados";
import { HAY_CONVEX } from "@/lib/hay-convex";
import {
  cursoresActivos,
  serieDeRecibidas,
  TAMANO_PAGINA_SERIE,
  type EstadoPaginas,
  type PaginaLista,
} from "@/lib/paginas-serie";

type ResumenDia = {
  verificadoHoyCentavos: number;
  porLiberar: number;
  enRevision: number;
};

export default function PanelPage() {
  const resumenRemoto = useQuery(api.cobros.resumenDelDia, HAY_CONVEX ? {} : "skip");
  const serie = useSerieCobros();

  if (!HAY_CONVEX) {
    return <ConfiguraConvex />;
  }

  return (
    <>
      <Suscripciones cursores={serie.cursores} onPagina={serie.reportar} />
      {resumenRemoto === undefined || !serie.estado.completo ? (
        <p className="text-muted">Cargando cobros…</p>
      ) : (
        <InicioListo resumen={resumenRemoto} filas={serie.estado.filas} parcial={serie.estado.parcial} />
      )}
    </>
  );
}

function InicioListo({
  resumen,
  filas,
  parcial,
}: {
  resumen: ResumenDia;
  filas: readonly CobroLista[];
  parcial: boolean;
}) {
  const rotulo = rotuloIngresos({ porCreacion: agrupaPorCreacion(filas), parcial });
  const recientes = filas.slice(0, TAMANO_PAGINA_SERIE);

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <h1 className="font-display text-3xl font-semibold text-ink">Inicio</h1>
      <section className="grid gap-3 sm:grid-cols-3">
        <TarjetaResumen titulo="Cobrado hoy" valor={<Monto centavos={resumen.verificadoHoyCentavos} />} />
        <TarjetaResumen titulo="Por liberar" valor={resumen.porLiberar} />
        <TarjetaResumen titulo="En revisión" valor={resumen.enRevision} />
      </section>
      <GraficaIngresos serie={serieIngresos(filas)} rotulo={rotulo} />
      <section id="cobros" className="flex min-w-0 flex-col gap-4">
        <h2 className="font-display text-xl font-semibold text-ink">Cobros recientes</h2>
        <TablaCobros cobros={recientes} />
      </section>
    </div>
  );
}

function Suscripciones({
  cursores,
  onPagina,
}: {
  cursores: readonly (string | null)[];
  onPagina: (indice: number, pagina: PaginaLista<CobroLista>) => void;
}) {
  return (
    <>
      {cursores.map((cursor, indice) => (
        <SuscripcionPagina
          key={`${indice}:${cursor ?? ""}`}
          indice={indice}
          cursor={cursor}
          onPagina={onPagina}
        />
      ))}
    </>
  );
}

function SuscripcionPagina({
  indice,
  cursor,
  onPagina,
}: {
  indice: number;
  cursor: string | null;
  onPagina: (indice: number, pagina: PaginaLista<CobroLista>) => void;
}) {
  const lista = useQuery(
    api.cobros.listar,
    HAY_CONVEX ? { paginationOpts: { numItems: TAMANO_PAGINA_SERIE, cursor } } : "skip",
  );
  const pagina = paginaSiLista(lista);

  useEffect(() => {
    if (pagina) {
      onPagina(indice, pagina);
    }
  }, [pagina, indice, onPagina]);

  return null;
}

function useSerieCobros(): {
  estado: EstadoPaginas<CobroLista>;
  cursores: (string | null)[];
  reportar: (indice: number, pagina: PaginaLista<CobroLista>) => void;
} {
  const [paginas, setPaginas] = useState<(PaginaLista<CobroLista> | null)[]>([]);
  const reportar = useCallback((indice: number, pagina: PaginaLista<CobroLista>) => {
    setPaginas((previas) => reemplazarPagina(previas, indice, pagina));
  }, []);

  return { estado: serieDeRecibidas(paginas), cursores: cursoresActivos(paginas), reportar };
}

function reemplazarPagina(
  previas: (PaginaLista<CobroLista> | null)[],
  indice: number,
  pagina: PaginaLista<CobroLista>,
): (PaginaLista<CobroLista> | null)[] {
  const actual = previas[indice] ?? null;
  if (actual && firmaPagina(actual) === firmaPagina(pagina)) {
    return previas;
  }
  const siguiente = previas.slice();
  siguiente[indice] = pagina;
  return siguiente;
}

function firmaPagina(pagina: PaginaLista<CobroLista>): string {
  return JSON.stringify({
    isDone: pagina.isDone,
    continueCursor: pagina.continueCursor,
    page: pagina.page,
  });
}

function paginaSiLista(
  lista:
    | {
        page: Parameters<typeof cobrosDePagina>[0];
        isDone: boolean;
        continueCursor: string;
      }
    | undefined,
): PaginaLista<CobroLista> | null {
  if (!lista) {
    return null;
  }
  return {
    page: cobrosDePagina(lista.page),
    isDone: lista.isDone,
    continueCursor: lista.continueCursor,
  };
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
      ...leerMarcas(fila),
    });
  }
  return filas;
}
