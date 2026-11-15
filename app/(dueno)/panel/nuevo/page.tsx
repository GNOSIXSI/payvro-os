"use client";

import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ConfiguraConvex } from "@/components/configura-convex";
import { MensajeOperacion } from "@/components/mensaje-operacion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/convex/_generated/api";
import { nuevaClave } from "@/lib/clave";
import { pesosACentavos } from "@/lib/formato";
import { HAY_CONVEX } from "@/lib/hay-convex";
import { mensajeDeError } from "@/lib/mensaje-error";

export default function NuevoCobroPage() {
  const router = useRouter();
  const crear = useMutation(api.cobros.crear);
  const [clave] = useState(nuevaClave);
  const [concepto, setConcepto] = useState("");
  const [monto, setMonto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, setPendiente] = useState(false);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError(null);
    let montoCentavos: number;
    try {
      montoCentavos = pesosACentavos(monto);
    } catch {
      setError("Escribe un monto válido, por ejemplo 450 o 0.01.");
      return;
    }
    const recortado = concepto.trim();
    if (recortado.length === 0 || recortado.length > 140) {
      setError("El concepto es obligatorio y no puede pasar de 140 caracteres.");
      return;
    }
    setPendiente(true);
    try {
      const creado = await crear({ claveIdempotencia: clave, concepto: recortado, montoCentavos });
      router.push(`/panel/cobros/${publicIdCreado(creado)}`);
    } catch (fallo) {
      setError(mensajeDeError(fallo));
      setPendiente(false);
    }
  }

  if (!HAY_CONVEX) {
    return <ConfiguraConvex />;
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
      <h1 className="font-display text-3xl font-semibold text-ink">Nuevo cobro</h1>
      <form className="flex flex-col gap-5" onSubmit={(evento) => void enviar(evento)}>
        <div className="flex flex-col gap-2">
          <Label htmlFor="concepto">Concepto</Label>
          <Input
            id="concepto"
            name="concepto"
            maxLength={140}
            value={concepto}
            onChange={(evento) => setConcepto(evento.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="monto">Monto</Label>
          <Input
            id="monto"
            name="monto"
            inputMode="decimal"
            autoComplete="off"
            value={monto}
            onChange={(evento) => setMonto(evento.target.value)}
            required
          />
        </div>
        {error ? <MensajeOperacion texto={error} /> : null}
        <Button type="submit" disabled={pendiente} className="min-h-11">
          {pendiente ? "Creando…" : "Crear cobro"}
        </Button>
      </form>
    </div>
  );
}

function publicIdCreado(resultado: unknown): string {
  if (typeof resultado === "object" && resultado !== null && "publicId" in resultado) {
    const id = (resultado as { publicId: unknown }).publicId;
    if (typeof id === "string" && id.length > 0) {
      return id;
    }
  }
  throw new Error("No se pudo abrir el cobro.");
}
