"use client";

import dynamic from "next/dynamic";
import { formatoMXN } from "@/lib/formato";
import type { DiaSerie } from "@/lib/serie";

const Barras = dynamic(() => import("@/components/barras-ingresos").then((mod) => mod.BarrasIngresos), {
  ssr: false,
});

export function GraficaIngresos({
  serie,
  prefijo,
  aviso,
}: {
  serie: readonly DiaSerie[];
  prefijo: string;
  aviso: string | null;
}) {
  const total = serie.reduce((suma, dia) => suma + dia.centavos, 0);
  return (
    <section aria-label="Ingresos de los últimos 7 días" className="flex min-w-0 flex-col gap-4">
      <h2 className="font-display text-xl font-semibold text-ink">Ingresos de los últimos 7 días</h2>
      {total === 0 ? (
        <p className="text-muted">Tus ingresos aparecerán aquí cuando cobres el primero.</p>
      ) : (
        <Barras serie={serie} />
      )}
      <ResumenSerie serie={serie} total={total} prefijo={prefijo} aviso={aviso} />
    </section>
  );
}

function ResumenSerie({
  serie,
  total,
  prefijo,
  aviso,
}: {
  serie: readonly DiaSerie[];
  total: number;
  prefijo: string;
  aviso: string | null;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      {aviso ? <p className="text-sm font-medium text-ink">{aviso}</p> : null}
      <p className="text-sm text-ink">
        {prefijo}: {formatoMXN(total)}
      </p>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {serie.map((dia) => (
          <li key={dia.clave} className="min-w-0 rounded-md border border-line bg-white px-2 py-2 text-sm text-ink">
            <span className="block text-muted">{dia.etiqueta}</span>
            {formatoMXN(dia.centavos)}
          </li>
        ))}
      </ul>
    </div>
  );
}
