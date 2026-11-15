import Link from "next/link";
import { ChipEstado } from "@/components/chip-estado";
import { Monto } from "@/components/monto";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { estadoParaDueno } from "@/lib/estados";
import type { CobroLista } from "@/lib/demo-fixtures";

export function TablaCobros({ cobros }: { cobros: readonly CobroLista[] }) {
  if (cobros.length === 0) {
    return <EstadoVacio />;
  }

  return (
    <>
      <div className="max-md:hidden">
        <TablaEscritorio cobros={cobros} />
      </div>
      <ul className="flex flex-col gap-3 md:hidden">
        {cobros.map((cobro) => (
          <li key={cobro.publicId}>
            <TarjetaCobro cobro={cobro} />
          </li>
        ))}
      </ul>
    </>
  );
}

function EstadoVacio() {
  return (
    <div className="flex flex-col items-start gap-4 rounded-xl border border-line bg-white p-6">
      <p className="text-ink">Aún no tienes cobros. Crea el primero.</p>
      <Link
        href="/panel/nuevo"
        className="inline-flex min-h-11 items-center justify-center rounded-md bg-petroleo px-4 py-2 text-sm font-semibold text-white motion-safe:transition-colors motion-safe:duration-200 motion-safe:ease-out hover:bg-ink"
      >
        Nuevo cobro
      </Link>
    </div>
  );
}

function TablaEscritorio({ cobros }: { cobros: readonly CobroLista[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Cobro</TableHead>
          <TableHead>Concepto</TableHead>
          <TableHead className="text-right">Monto</TableHead>
          <TableHead>Estado</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {cobros.map((cobro) => (
          <TableRow key={cobro.publicId}>
            <TableCell>
              <Link href={`/panel/cobros/${cobro.publicId}`} className="font-medium text-petroleo">
                #{cobro.folio}
              </Link>
            </TableCell>
            <TableCell>{cobro.concepto}</TableCell>
            <TableCell className="text-right">
              <Monto centavos={cobro.montoCentavos} />
            </TableCell>
            <TableCell>
              <ChipEstado {...estadoParaDueno(cobro.estado)} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function TarjetaCobro({ cobro }: { cobro: CobroLista }) {
  return (
    <Link
      href={`/panel/cobros/${cobro.publicId}`}
      className="flex min-h-11 flex-col gap-2 rounded-xl border border-line bg-white p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium text-petroleo">#{cobro.folio}</span>
        <Monto centavos={cobro.montoCentavos} className="font-medium" />
      </div>
      <p className="text-sm text-ink">{cobro.concepto}</p>
      <ChipEstado {...estadoParaDueno(cobro.estado)} />
    </Link>
  );
}
