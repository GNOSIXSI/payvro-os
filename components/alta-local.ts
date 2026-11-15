"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  esColorMarca,
  esGiro,
  type ColorMarca,
  type Giro,
} from "../lib/negocio-opciones";

export type AltaGuardada = {
  nombre: string;
  giro: Giro;
  colorMarca: ColorMarca;
};

export type AltaLocal = AltaGuardada | "pendiente";

export const GIROS_ALTA: readonly { valor: Giro; etiqueta: string }[] = [
  { valor: "social", etiqueta: "Vendo por WhatsApp/Instagram" },
  { valor: "citas", etiqueta: "Servicios con cita" },
  { valor: "cotizaciones", etiqueta: "Cotizaciones" },
  { valor: "mostrador", etiqueta: "Mostrador" },
  { valor: "membresias", etiqueta: "Membresías" },
  { valor: "tienda", etiqueta: "Tienda en línea" },
];

export const PERFIL_OMITIDO: AltaGuardada = {
  nombre: "Mi negocio",
  giro: "social",
  colorMarca: "#076B76",
};

const CLAVE = "payvro.alta";
const EVENTO = "payvro-alta";

let cacheCrudo: string | null | undefined;
let cacheValor: AltaLocal | null = null;

export function decidirAlta(entrada: {
  hayConvex: boolean;
  nombreRemoto: string | null | undefined;
  altaLocal: AltaLocal | null;
  nombreDemo: string;
}): { mostrarAsistente: boolean; nombre: string } {
  if (entrada.hayConvex) {
    return decisionRemota(entrada.nombreRemoto);
  }
  return decisionLocal(entrada.altaLocal, entrada.nombreDemo);
}

export function interpretarAlta(crudo: string | null): AltaLocal | null {
  if (crudo === null) {
    return null;
  }
  if (crudo === "pendiente") {
    return "pendiente";
  }
  return parsearAlta(crudo);
}

export function leerAltaLocal(): AltaLocal | null {
  if (typeof window === "undefined") {
    return null;
  }
  const crudo = window.sessionStorage.getItem(CLAVE);
  if (crudo === cacheCrudo) {
    return cacheValor;
  }
  cacheCrudo = crudo;
  cacheValor = interpretarAlta(crudo);
  return cacheValor;
}

export function guardarAltaLocal(alta: AltaLocal): void {
  const valor = alta === "pendiente" ? "pendiente" : JSON.stringify(alta);
  window.sessionStorage.setItem(CLAVE, valor);
  cacheCrudo = valor;
  cacheValor = alta === "pendiente" ? "pendiente" : { ...alta, nombre: alta.nombre.trim() };
  window.dispatchEvent(new Event(EVENTO));
}

export function useAltaLocal(): AltaLocal | null {
  return useSyncExternalStore(suscribirAlta, leerAltaLocal, () => null);
}

export function useAltaLista(): boolean {
  const [lista, setLista] = useState(false);
  useEffect(() => {
    setLista(true);
  }, []);
  return lista;
}

function decisionRemota(nombreRemoto: string | null | undefined): { mostrarAsistente: boolean; nombre: string } {
  if (nombreRemoto === undefined || nombreRemoto === null) {
    return { mostrarAsistente: false, nombre: "" };
  }
  const nombre = nombreRemoto.trim();
  if (nombre.length === 0) {
    return { mostrarAsistente: true, nombre: "" };
  }
  return { mostrarAsistente: false, nombre };
}

function decisionLocal(
  altaLocal: AltaLocal | null,
  nombreDemo: string,
): { mostrarAsistente: boolean; nombre: string } {
  if (altaLocal === "pendiente") {
    return { mostrarAsistente: true, nombre: "" };
  }
  if (altaLocal && altaLocal.nombre.trim().length > 0) {
    return { mostrarAsistente: false, nombre: altaLocal.nombre.trim() };
  }
  return { mostrarAsistente: false, nombre: nombreDemo };
}

function parsearAlta(crudo: string): AltaGuardada | null {
  let valor: unknown;
  try {
    valor = JSON.parse(crudo);
  } catch (fallo: unknown) {
    if (fallo instanceof SyntaxError) {
      return null;
    }
    throw fallo;
  }
  if (!esAltaGuardada(valor)) {
    return null;
  }
  return {
    nombre: valor.nombre.trim(),
    giro: valor.giro,
    colorMarca: valor.colorMarca,
  };
}

function esAltaGuardada(valor: unknown): valor is AltaGuardada {
  if (typeof valor !== "object" || valor === null) {
    return false;
  }
  if (!("nombre" in valor) || !("giro" in valor) || !("colorMarca" in valor)) {
    return false;
  }
  const { nombre, giro, colorMarca } = valor;
  return (
    typeof nombre === "string" &&
    nombre.trim().length > 0 &&
    nombre.trim().length <= 40 &&
    typeof giro === "string" &&
    esGiro(giro) &&
    typeof colorMarca === "string" &&
    esColorMarca(colorMarca)
  );
}

function suscribirAlta(aviso: () => void): () => void {
  window.addEventListener(EVENTO, aviso);
  window.addEventListener("storage", aviso);
  return () => {
    window.removeEventListener(EVENTO, aviso);
    window.removeEventListener("storage", aviso);
  };
}
