"use client";

import { useMutation, useQuery } from "convex/react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  GIROS_ALTA,
  PERFIL_OMITIDO,
  decidirAlta,
  guardarAltaLocal,
  useFotoAlta,
  type AltaGuardada,
} from "@/components/alta-local";
import { MensajeOperacion } from "@/components/mensaje-operacion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/convex/_generated/api";
import { NEGOCIO_DEMO } from "@/lib/demo-fixtures";
import { HAY_CONVEX } from "@/lib/hay-convex";
import { mensajeDeError } from "@/lib/mensaje-error";
import { COLORES_MARCA, type ColorMarca, type Giro } from "@/lib/negocio-opciones";

export function AsistenteAlta() {
  const router = useRouter();
  const foto = useFotoAlta();
  const negocio = useQuery(api.negocio.obtener, HAY_CONVEX ? {} : "skip");
  const decision = decidirAlta({
    hayConvex: HAY_CONVEX,
    nombreRemoto: negocio?.nombre,
    altaLocal: foto.alta,
    nombreDemo: NEGOCIO_DEMO.nombre,
  });

  useEffect(() => {
    if (foto.lista && !decision.mostrarAsistente) {
      router.replace("/panel");
    }
  }, [foto.lista, decision.mostrarAsistente, router]);

  if (!foto.lista || (HAY_CONVEX && negocio === undefined)) {
    return <p className="p-6 text-muted">Cargando…</p>;
  }
  if (!decision.mostrarAsistente) {
    return <p className="p-6 text-muted">Abriendo el panel…</p>;
  }
  return <PasosAlta />;
}

function PasosAlta() {
  const [paso, setPaso] = useState<1 | 2 | 3>(1);
  const [giro, setGiro] = useState<Giro>("social");
  const [nombre, setNombre] = useState("");
  const [color, setColor] = useState<ColorMarca>("#076B76");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, setPendiente] = useState(false);
  const cerrar = useCierreAlta(setError, setPendiente);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col gap-6 px-4 py-8">
      <Link href="/" className="inline-flex min-h-11 items-center">
        <Image src="/brand/payvro-logo-claro.svg" alt="PAYVRO" width={140} height={28} priority />
      </Link>
      <p className="text-sm text-muted">Paso {paso} de 3</p>
      {paso === 1 ? <PasoCuenta onContinuar={() => setPaso(2)} /> : null}
      {paso === 2 ? (
        <PasoGiro giro={giro} onGiro={setGiro} onContinuar={() => setPaso(3)} onAtras={() => setPaso(1)} />
      ) : null}
      {paso === 3 ? (
        <PasoNegocio
          nombre={nombre}
          color={color}
          giro={giro}
          error={error}
          pendiente={pendiente}
          onNombre={setNombre}
          onColor={setColor}
          onAtras={() => setPaso(2)}
          onListo={(perfil) => void cerrar(perfil, true)}
          onOmitir={() => void cerrar(PERFIL_OMITIDO, false)}
        />
      ) : null}
    </main>
  );
}

function PasoCuenta({ onContinuar }: { onContinuar: () => void }) {
  return (
    <section className="flex flex-col gap-4">
      <h1 className="font-display text-3xl font-semibold text-ink">Cuenta</h1>
      <p className="text-ink">Ya entraste. En DEMO el dueño es quien abre este panel. No hace falta otra cuenta.</p>
      <Button type="button" onClick={onContinuar}>
        Continuar
      </Button>
    </section>
  );
}

function PasoGiro({
  giro,
  onGiro,
  onContinuar,
  onAtras,
}: {
  giro: Giro;
  onGiro: (valor: Giro) => void;
  onContinuar: () => void;
  onAtras: () => void;
}) {
  return (
    <section className="flex flex-col gap-4">
      <h1 className="font-display text-3xl font-semibold text-ink">Elige tu giro</h1>
      <p className="text-ink">Así preparamos tu cobro. Lo puedes cambiar después en Ajustes.</p>
      <div role="radiogroup" aria-label="Giro del negocio" className="flex flex-col gap-2">
        {GIROS_ALTA.map((opcion) => (
          <button
            key={opcion.valor}
            type="button"
            role="radio"
            aria-checked={giro === opcion.valor}
            onClick={() => onGiro(opcion.valor)}
            className={`min-h-11 rounded-md border px-3 text-left text-sm font-medium text-ink ${giro === opcion.valor ? "border-petroleo bg-paper" : "border-line bg-white"}`}
          >
            {opcion.etiqueta}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onAtras}>
          Atrás
        </Button>
        <Button type="button" onClick={onContinuar}>
          Continuar
        </Button>
      </div>
    </section>
  );
}

function PasoNegocio({
  nombre,
  color,
  giro,
  error,
  pendiente,
  onNombre,
  onColor,
  onAtras,
  onListo,
  onOmitir,
}: {
  nombre: string;
  color: ColorMarca;
  giro: Giro;
  error: string | null;
  pendiente: boolean;
  onNombre: (valor: string) => void;
  onColor: (valor: ColorMarca) => void;
  onAtras: () => void;
  onListo: (perfil: AltaGuardada) => void;
  onOmitir: () => void;
}) {
  return (
    <section className="flex flex-col gap-4">
      <h1 className="font-display text-3xl font-semibold text-ink">Tu negocio</h1>
      <p className="text-ink">Así te verá tu cliente en la página de pago.</p>
      <div className="flex flex-col gap-2">
        <Label htmlFor="alta-nombre">Nombre</Label>
        <Input
          id="alta-nombre"
          name="nombre"
          maxLength={40}
          value={nombre}
          onChange={(evento) => onNombre(evento.target.value)}
        />
      </div>
      <Muestras color={color} onColor={onColor} />
      <VistaPrevia nombre={nombre} color={color} />
      {error ? <MensajeOperacion texto={error} /> : null}
      <div className="flex flex-col gap-2">
        <Button type="button" disabled={pendiente} onClick={() => enviarNombre(nombre, giro, color, onListo)}>
          {pendiente ? "Guardando…" : "Ir a mi panel"}
        </Button>
        <Button type="button" variant="ghost" disabled={pendiente} onClick={onOmitir}>
          Omitir
        </Button>
        <Button type="button" variant="outline" onClick={onAtras}>
          Atrás
        </Button>
      </div>
    </section>
  );
}

function Muestras({ color, onColor }: { color: ColorMarca; onColor: (valor: ColorMarca) => void }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium text-ink">Color</legend>
      <div className="flex flex-wrap gap-3">
        {COLORES_MARCA.map((muestra) => (
          <button
            key={muestra}
            type="button"
            aria-label={`Color ${muestra}`}
            aria-pressed={color === muestra}
            onClick={() => onColor(muestra)}
            className="size-11 rounded-full border-2 border-white shadow-[0_0_0_1px_#d9d5c8]"
            style={{
              backgroundColor: muestra,
              outline: color === muestra ? "3px solid #076B76" : undefined,
            }}
          />
        ))}
      </div>
    </fieldset>
  );
}

function VistaPrevia({ nombre, color }: { nombre: string; color: ColorMarca }) {
  return (
    <section aria-label="Vista previa del pago" className="overflow-hidden rounded-xl border border-line">
      <header className="flex min-h-14 items-center px-4 py-3 text-white" style={{ backgroundColor: color }}>
        <p className="font-display text-lg font-semibold">{nombre.trim() || "Tu negocio"}</p>
      </header>
    </section>
  );
}

function enviarNombre(
  nombre: string,
  giro: Giro,
  color: ColorMarca,
  onListo: (perfil: AltaGuardada) => void,
) {
  const recortado = nombre.trim();
  if (recortado.length === 0 || recortado.length > 40) {
    onListo({ nombre: "", giro, colorMarca: color });
    return;
  }
  onListo({ nombre: recortado, giro, colorMarca: color });
}

function useCierreAlta(
  setError: (valor: string | null) => void,
  setPendiente: (valor: boolean) => void,
): (perfil: AltaGuardada, bloquearSiFalla: boolean) => Promise<void> {
  const router = useRouter();
  const actualizar = useMutation(api.negocio.actualizarPerfil);
  return async (perfil, bloquearSiFalla) => {
    const recortado = perfil.nombre.trim();
    if (recortado.length === 0 || recortado.length > 40) {
      setError("El nombre es obligatorio y no puede pasar de 40 caracteres.");
      return;
    }
    setError(null);
    setPendiente(true);
    const siguio = await guardarEnServidor(
      { ...perfil, nombre: recortado },
      bloquearSiFalla,
      actualizar,
      setError,
    );
    setPendiente(false);
    if (!siguio) {
      return;
    }
    guardarAltaLocal({ ...perfil, nombre: recortado });
    router.push("/panel");
  };
}

async function guardarEnServidor(
  perfil: AltaGuardada,
  bloquearSiFalla: boolean,
  actualizar: (args: { nombre: string; giro: Giro; colorMarca: ColorMarca }) => Promise<{ ok: boolean }>,
  setError: (valor: string | null) => void,
): Promise<boolean> {
  if (!HAY_CONVEX) {
    return true;
  }
  try {
    await actualizar({ nombre: perfil.nombre, giro: perfil.giro, colorMarca: perfil.colorMarca });
    return true;
  } catch (fallo: unknown) {
    if (bloquearSiFalla) {
      setError(mensajeDeError(fallo));
      return false;
    }
    return true;
  }
}

