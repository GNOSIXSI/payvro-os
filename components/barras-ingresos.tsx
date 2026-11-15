"use client";

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { ChartContainer } from "@/components/ui/chart";
import { formatoMXN } from "@/lib/formato";
import type { DiaSerie } from "@/lib/serie";

export function BarrasIngresos({ serie }: { serie: readonly DiaSerie[] }) {
  const datos = serie.map((dia) => ({ etiqueta: dia.etiqueta, centavos: dia.centavos }));
  const maximo = datos.reduce((maximoActual, dia) => Math.max(maximoActual, dia.centavos), 0);

  return (
    <ChartContainer>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={datos} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <XAxis dataKey="etiqueta" tick={{ fill: "#4A5E6B", fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis
            width={84}
            ticks={maximo === 0 ? [0] : [0, maximo]}
            domain={[0, maximo === 0 ? 1 : maximo]}
            allowDecimals={false}
            tickFormatter={tickEnPesos}
            tick={{ fill: "#4A5E6B", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <Bar dataKey="centavos" fill="#076B76" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}

function tickEnPesos(valor: number): string {
  const centavos = Number.isSafeInteger(valor) ? valor : Math.round(valor);
  if (!Number.isSafeInteger(centavos)) {
    return formatoMXN(0);
  }
  return formatoMXN(centavos);
}
