"use client";

import { useState } from "react";
import { BotonCopiar } from "@/components/boton-copiar";
import { ChipEstado } from "@/components/chip-estado";
import { LineaDeTiempo, type EntradaBitacora } from "@/components/linea-de-tiempo";
import { Monto } from "@/components/monto";
import { QrCodi } from "@/components/qr-codi";
import { Button } from "@/components/ui/button";
import { estadoParaDueno } from "@/lib/estados";
import type { EstadoCobro } from "@/lib/estados";
import { textoDeMotivo } from "@/lib/motivos";
import { destinoDeCopia } from "@/lib/url-copia";

export type DetalleCobroDatos = {
  publicId: string;
  folio: number;
  concepto: string;
  montoCentavos: number;
  estado: EstadoCobro;
  intentoActivo: {
    estado: string;
    qrString?: string;
    urlPago?: string;
  } | null;
  pago: { resultado: string } | null;
};

export function DetalleCobro({
  cobro,
  bitacora,
}: {
  cobro: DetalleCobroDatos;
  bitacora: readonly EntradaBitacora[];
}) {
  const vista = estadoParaDueno(cobro.estado);
  const creando = !cobro.intentoActivo || cobro.intentoActivo.estado === "reservado";
  const qrString = cobro.intentoActivo?.qrString;
  const motivo = cobro.estado === "en_revision" ? textoDeMotivo(cobro.pago?.resultado) : null;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <p className="text-sm text-muted">#{cobro.folio}</p>
        <h1 className="font-display text-3xl font-semibold text-ink">{cobro.concepto}</h1>
        <Monto centavos={cobro.montoCentavos} className="font-display text-4xl font-semibold" />
        <div aria-live="polite">
          <ChipEstado {...vista} />
        </div>
      </header>
      {creando ? <p className="text-muted">Creando el QR CoDi…</p> : null}
      {!creando && qrString ? <MostrarQr valor={qrString} /> : null}
      <CopiaPagina publicId={cobro.publicId} urlPago={cobro.intentoActivo?.urlPago} />
      <WhatsAppDeshabilitado />
      {motivo ? (
        <p className="text-ink">
          {motivo} No se liberó automáticamente.
        </p>
      ) : null}
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-semibold">Bitácora</h2>
        <LineaDeTiempo entradas={bitacora} />
      </section>
    </div>
  );
}

function MostrarQr({ valor }: { valor: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="flex flex-col items-start gap-3">
      <Button type="button" variant="outline" onClick={() => setVisible((hoy) => !hoy)}>
        {visible ? "Ocultar QR" : "Mostrar QR"}
      </Button>
      {visible ? (
        <QrCodi
          valor={valor}
          caption="Escanea con la app de tu banco para pagar con CoDi"
        />
      ) : null}
    </div>
  );
}

function CopiaPagina({ publicId, urlPago }: { publicId: string; urlPago?: string }) {
  return (
    <BotonCopiar
      etiqueta="Copiar link"
      obtenerTexto={() => destinoDeCopia(publicId, urlPago).texto}
    />
  );
}

function WhatsAppDeshabilitado() {
  return (
    <div className="flex flex-col gap-2">
      <Button type="button" variant="outline" disabled>
        Enviar por WhatsApp
      </Button>
      <p className="text-sm text-muted">Disponible en PAYVRO Cloud (plan Pro)</p>
    </div>
  );
}
