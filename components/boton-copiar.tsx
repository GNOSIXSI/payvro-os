"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function BotonCopiar({
  etiqueta,
  obtenerTexto,
}: {
  etiqueta: string;
  obtenerTexto: () => string;
}) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    await navigator.clipboard.writeText(obtenerTexto());
    setCopiado(true);
  }

  return (
    <Button type="button" onClick={() => void copiar()} className="min-h-11">
      {copiado ? "Copiado" : etiqueta}
    </Button>
  );
}
