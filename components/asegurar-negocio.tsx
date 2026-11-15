"use client";

import { ConvexError } from "convex/values";
import { useMutation, useQuery } from "convex/react";
import { Component, useCallback, useEffect, useState, type ReactNode } from "react";
import { api } from "@/convex/_generated/api";
import { HAY_CONVEX } from "@/lib/hay-convex";

const PERFIL_DEMO = {
  nombre: "Dulces Ana — Ejemplo",
  giro: "social",
  colorMarca: "#076B76",
} as const;

const AVISO_AUSENTE = "El negocio todavía no está configurado.";

export function AsegurarNegocio({ children }: { children: ReactNode }) {
  const [listo, setListo] = useState(!HAY_CONVEX);
  const marcar = useCallback(() => setListo(true), []);
  if (!HAY_CONVEX || listo) {
    return children;
  }
  return (
    <LimiteNegocio>
      <SondaNegocio onListo={marcar} />
    </LimiteNegocio>
  );
}

type EstadoLimite = { error: Error | null; intentos: number };

class LimiteNegocio extends Component<{ children: ReactNode }, EstadoLimite> {
  state: EstadoLimite = { error: null, intentos: 0 };

  static getDerivedStateFromError(error: Error): Pick<EstadoLimite, "error"> {
    return { error };
  }

  private reintentar = () => {
    this.setState((estado) => ({ error: null, intentos: estado.intentos + 1 }));
  };

  render() {
    const { error, intentos } = this.state;
    if (error && esNegocioAusente(error) && intentos < 1) {
      return <PrepararDemo onListo={this.reintentar} />;
    }
    if (error && esNegocioAusente(error)) {
      return <p className="px-6 py-12 text-ink">No se pudo preparar el negocio de práctica.</p>;
    }
    if (error) {
      return <p className="px-6 py-12 text-ink">No se pudo cargar la cuenta.</p>;
    }
    return this.props.children;
  }
}

function SondaNegocio({ onListo }: { onListo: () => void }) {
  const negocio = useQuery(api.negocio.obtener, {});
  useEffect(() => {
    if (negocio) onListo();
  }, [negocio, onListo]);
  return <p className="px-6 py-12 text-ink">Preparando la cuenta de práctica…</p>;
}

function PrepararDemo({ onListo }: { onListo: () => void }) {
  const actualizar = useMutation(api.negocio.actualizarPerfil);
  useEffect(() => {
    let vivo = true;
    void actualizar(PERFIL_DEMO)
      .then(() => {
        if (vivo) onListo();
      })
      .catch(() => {
        if (vivo) onListo();
      });
    return () => {
      vivo = false;
    };
  }, [actualizar, onListo]);
  return <p className="px-6 py-12 text-ink">Preparando la cuenta de práctica…</p>;
}

function esNegocioAusente(error: Error): boolean {
  if (error instanceof ConvexError && datosDeAusente(error.data)) {
    return true;
  }
  return error.message.includes(AVISO_AUSENTE);
}

function datosDeAusente(data: unknown): boolean {
  if (typeof data !== "object" || data === null) return false;
  if (!("codigo" in data) || !("mensaje" in data)) return false;
  return data.codigo === "NO_ENCONTRADO" && data.mensaje === AVISO_AUSENTE;
}
