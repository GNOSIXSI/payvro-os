"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { MensajeOperacion } from "@/components/mensaje-operacion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/convex/_generated/api";
import { HAY_CONVEX } from "@/lib/hay-convex";
import { mensajeDeError } from "@/lib/mensaje-error";
import {
  COLORES_MARCA,
  GIROS,
  esColorMarca,
  esGiro,
  type ColorMarca,
  type Giro,
} from "@/lib/negocio-opciones";

export type NegocioAjustes = {
  nombre: string;
  giro: string;
  colorMarca: string;
  modo: "demo" | "live";
  cuentaLista: boolean;
};

export function FormaAjustes({ negocio }: { negocio: NegocioAjustes }) {
  const actualizar = useMutation(api.negocio.actualizarPerfil);
  const [nombre, setNombre] = useState(negocio.nombre);
  const [giro, setGiro] = useState<Giro>(esGiro(negocio.giro) ? negocio.giro : "tienda");
  const [color, setColor] = useState<ColorMarca>(
    esColorMarca(negocio.colorMarca) ? negocio.colorMarca : "#076B76",
  );
  const [error, setError] = useState<string | null>(null);
  const [pendiente, setPendiente] = useState(false);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-8">
      <h1 className="font-display text-3xl font-semibold text-ink">Ajustes</h1>
      <CamposPerfil
        nombre={nombre}
        giro={giro}
        color={color}
        onNombre={setNombre}
        onGiro={setGiro}
        onColor={setColor}
      />
      {error ? <MensajeOperacion texto={error} /> : null}
      <Button
        type="button"
        disabled={pendiente}
        onClick={() =>
          void guardarPerfil({ nombre, giro, color, actualizar, setError, setPendiente })
        }
      >
        {pendiente ? "Guardando…" : "Guardar"}
      </Button>
      <BloqueModo modo={negocio.modo} cuentaLista={negocio.cuentaLista} />
    </div>
  );
}

function CamposPerfil({
  nombre,
  giro,
  color,
  onNombre,
  onGiro,
  onColor,
}: {
  nombre: string;
  giro: Giro;
  color: ColorMarca;
  onNombre: (valor: string) => void;
  onGiro: (valor: Giro) => void;
  onColor: (valor: ColorMarca) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="nombre">Nombre</Label>
        <Input
          id="nombre"
          name="nombre"
          maxLength={40}
          value={nombre}
          onChange={(evento) => onNombre(evento.target.value)}
        />
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-ink">Giro</legend>
        <select
          id="giro"
          aria-label="Giro"
          className="min-h-11 rounded-md border border-line bg-white px-3 text-base"
          value={giro}
          onChange={(evento) => {
            if (esGiro(evento.target.value)) {
              onGiro(evento.target.value);
            }
          }}
        >
          {GIROS.map((opcion) => (
            <option key={opcion.valor} value={opcion.valor}>
              {opcion.etiqueta}
            </option>
          ))}
        </select>
      </fieldset>
      <MuestrasColor color={color} onColor={onColor} />
    </div>
  );
}

function MuestrasColor({
  color,
  onColor,
}: {
  color: ColorMarca;
  onColor: (valor: ColorMarca) => void;
}) {
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
            className="size-11 rounded-full border-2 border-white shadow-[0_0_0_1px_#d9d5c8] motion-safe:duration-200 motion-safe:ease-out"
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

function BloqueModo({ modo, cuentaLista }: { modo: "demo" | "live"; cuentaLista: boolean }) {
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-line bg-white p-6 text-sm text-ink">
      <p>Modo: {modo === "live" ? "LIVE" : "DEMO"}</p>
      <p>Cuenta en pey: {cuentaLista ? "lista" : "en validación"}</p>
    </section>
  );
}

async function guardarPerfil(args: {
  nombre: string;
  giro: Giro;
  color: ColorMarca;
  actualizar: (args: { nombre: string; giro: Giro; colorMarca: ColorMarca }) => Promise<{ ok: boolean }>;
  setError: (valor: string | null) => void;
  setPendiente: (valor: boolean) => void;
}) {
  args.setError(null);
  const recortado = args.nombre.trim();
  if (recortado.length === 0 || recortado.length > 40) {
    args.setError("El nombre es obligatorio y no puede pasar de 40 caracteres.");
    return;
  }
  args.setPendiente(true);
  try {
    if (!HAY_CONVEX) {
      throw new Error("La actualización del perfil todavía no está disponible.");
    }
    await args.actualizar({ nombre: recortado, giro: args.giro, colorMarca: args.color });
  } catch (fallo) {
    args.setError(mensajeDeError(fallo));
  } finally {
    args.setPendiente(false);
  }
}
