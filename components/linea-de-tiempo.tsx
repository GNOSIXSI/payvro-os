import { formatoFechaHora } from "@/lib/tiempo";
import { textoDeEvento } from "@/lib/motivos";

const HITOS = [
  { tipo: "cobro.creado", etiqueta: "Cobro creado" },
  { tipo: "pago.verificado", etiqueta: "Pago verificado" },
  { tipo: "cobro.liberado", etiqueta: "Liberado" },
] as const;

export type EntradaBitacora = {
  tipo: string;
  en: number;
};

function horaDe(entradas: readonly EntradaBitacora[], tipo: string): number | null {
  const entrada = entradas.find((item) => item.tipo === tipo);
  return entrada ? entrada.en : null;
}

export function LineaDeTiempo({ entradas }: { entradas: readonly EntradaBitacora[] }) {
  return (
    <ol className="space-y-4">
      {HITOS.map((hito) => {
        const en = horaDe(entradas, hito.tipo);
        return (
          <li key={hito.tipo} className="flex flex-col gap-1 border-l-2 border-line pl-4">
            <span className="font-medium text-ink">{hito.etiqueta}</span>
            <span className="text-sm text-muted">{en === null ? "Pendiente" : formatoFechaHora(en)}</span>
          </li>
        );
      })}
      {entradas.map((entrada, index) => {
        const texto = textoDeEvento(entrada.tipo);
        if (!texto) return null;
        return (
          <li key={`${entrada.tipo}-${index}`} className="flex flex-col gap-1 border-l-2 border-line pl-4">
            <span className="font-medium text-ink">{texto}</span>
            <span className="text-sm text-muted">{formatoFechaHora(entrada.en)}</span>
          </li>
        );
      })}
    </ol>
  );
}
