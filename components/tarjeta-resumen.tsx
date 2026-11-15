import type { ReactNode } from "react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function TarjetaResumen({ titulo, valor }: { titulo: string; valor: ReactNode }) {
  return (
    <Card>
      <CardHeader className="gap-2">
        <CardDescription>{titulo}</CardDescription>
        <CardTitle className="font-display text-2xl font-semibold tracking-tight">{valor}</CardTitle>
      </CardHeader>
    </Card>
  );
}
