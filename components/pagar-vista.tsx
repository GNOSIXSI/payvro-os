"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { ChipEstado } from "@/components/chip-estado";
import { EtiquetaDemo } from "@/components/etiqueta-demo";
import { MensajeOperacion } from "@/components/mensaje-operacion";
import { Monto } from "@/components/monto";
import { QrCodi } from "@/components/qr-codi";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { vistaPagadorPorEtiqueta, type VistaEstado } from "@/lib/estados";
import { mensajeDeError } from "@/lib/mensaje-error";

export type CobroPublicoVista = {
  negocio: { nombre: string; colorMarca: string };
  folio: number;
  concepto: string;
  montoCentavos: number;
  estadoVisible: string;
  qrString?: string;
  urlPago?: string;
  modo: "demo" | "live";
};

export function PagarVista({ cobro, publicId }: { cobro: CobroPublicoVista; publicId: string }) {
  const vista = vistaPagadorPorEtiqueta(cobro.estadoVisible);
  if (cobro.estadoVisible === "Pago verificado") {
    return <PagarVerificado cobro={cobro} />;
  }
  if (cobro.estadoVisible === "Estamos revisando tu pago") {
    return <PagarRevision cobro={cobro} />;
  }
  if (cobro.estadoVisible === "Esperando pago") {
    return <PagarEsperando cobro={cobro} publicId={publicId} vista={vista} />;
  }
  return <PagarCerrado cobro={cobro} />;
}

export function PagarAusente() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-lg text-ink">Este cobro no existe o ya no está disponible.</p>
    </main>
  );
}

function Encabezado({ cobro }: { cobro: CobroPublicoVista }) {
  return (
    <header
      className="flex items-center justify-between gap-3 px-6 py-4 text-white"
      style={{ backgroundColor: cobro.negocio.colorMarca }}
    >
      <h1 className="font-display text-lg font-semibold">{cobro.negocio.nombre}</h1>
      {cobro.modo === "demo" ? <EtiquetaDemo /> : null}
    </header>
  );
}

function PagarVerificado({ cobro }: { cobro: CobroPublicoVista }) {
  return (
    <div className="min-h-screen bg-paper">
      <Encabezado cobro={cobro} />
      <main className="mx-auto flex max-w-lg flex-col items-center gap-4 px-6 py-12 text-center">
        <span aria-hidden="true" className="text-5xl text-petroleo">
          ✓
        </span>
        <h2 className="font-display text-3xl font-semibold text-ink">Pago verificado</h2>
        <p className="text-ink">{cobro.negocio.nombre} ya recibió tu pago.</p>
      </main>
    </div>
  );
}

function PagarRevision({ cobro }: { cobro: CobroPublicoVista }) {
  return (
    <div className="min-h-screen bg-paper">
      <Encabezado cobro={cobro} />
      <main className="mx-auto flex max-w-lg flex-col gap-4 px-6 py-12">
        <p className="text-lg text-ink">
          Estamos revisando tu pago. {cobro.negocio.nombre} te contactará.
        </p>
      </main>
    </div>
  );
}

function PagarCerrado({ cobro }: { cobro: CobroPublicoVista }) {
  return (
    <div className="min-h-screen bg-paper">
      <Encabezado cobro={cobro} />
      <main className="mx-auto flex max-w-lg flex-col gap-4 px-6 py-12">
        <p className="text-lg text-ink">Este cobro ya no está disponible.</p>
      </main>
    </div>
  );
}

function PagarEsperando({
  cobro,
  publicId,
  vista,
}: {
  cobro: CobroPublicoVista;
  publicId: string;
  vista: VistaEstado;
}) {
  return (
    <div className="min-h-screen bg-paper">
      <Encabezado cobro={cobro} />
      <main className="mx-auto flex max-w-lg flex-col gap-6 px-6 py-8">
        <Monto centavos={cobro.montoCentavos} className="font-display text-5xl font-semibold" />
        <p className="text-sm text-muted">#{cobro.folio}</p>
        <p className="text-ink">{cobro.concepto}</p>
        <div aria-live="polite">
          <ChipEstado {...vista} />
        </div>
        <QrYLink cobro={cobro} />
        {cobro.modo === "demo" ? <SimularPago publicId={publicId} /> : null}
      </main>
    </div>
  );
}

function QrYLink({ cobro }: { cobro: CobroPublicoVista }) {
  return (
    <>
      {cobro.qrString ? (
        <QrCodi
          valor={cobro.qrString}
          caption={`Escanea con la app de tu banco para pagar. El dinero va directo a ${cobro.negocio.nombre}.`}
        />
      ) : null}
      {cobro.urlPago ? (
        <a
          href={cobro.urlPago}
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-petroleo px-4 text-sm font-semibold text-white hover:bg-ink"
        >
          Pagar con link
        </a>
      ) : null}
    </>
  );
}

function SimularPago({ publicId }: { publicId: string }) {
  const simular = useMutation(api.demo.simularPago);
  const [pendiente, setPendiente] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function lanzar() {
    setError(null);
    setPendiente(true);
    try {
      await simular({ publicId, variante: "exacto" });
    } catch (fallo) {
      setError(mensajeDeError(fallo));
    } finally {
      setPendiente(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Button type="button" variant="outline" disabled={pendiente} onClick={() => void lanzar()}>
        {pendiente ? "Verificando con pey…" : "Simular pago"}
      </Button>
      {error ? <MensajeOperacion texto={error} /> : null}
    </div>
  );
}
