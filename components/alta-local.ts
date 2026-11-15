"use client";

import { useSyncExternalStore } from "react";
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

export type FotoAlta = { lista: boolean; alta: AltaLocal | null };

const FOTO_SERVIDOR: FotoAlta = { lista: false, alta: null };
let fotoCache: FotoAlta = FOTO_SERVIDOR;
let fotoCrudo: string | null | undefined;

export function decidirAlta(entrada: {
  hayConvex: boolean;
  nombreRemoto: string | null | undefined;
  altaLocal: AltaLocal | null;
  nombreDemo: string;
}): { mostrarAsistente: boolean; nombre: string } {
  if (entrada.hayConvex) {
    return decisionRemota(entrada.nombreRemoto, entrada.altaLocal);
  }
  return decisionLocal(entrada.altaLocal, entrada.nombreDemo);
}

export function seguirTrasFallo(bloquearSiFalla: boolean, fallo: unknown): boolean {
  if (!bloquearSiFalla) {
    return true;
  }
  return codigoDeFallo(fallo) === "NO_IMPLEMENTADO";
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

export function leerFotoAlta(): FotoAlta {
  if (typeof window === "undefined") {
    return FOTO_SERVIDOR;
  }
  const crudo = window.sessionStorage.getItem(CLAVE);
  if (fotoCache.lista && crudo === fotoCrudo) {
    return fotoCache;
  }
  fotoCrudo = crudo;
  fotoCache = { lista: true, alta: interpretarAlta(crudo) };
  return fotoCache;
}

export function guardarAltaLocal(alta: AltaLocal): void {
  const perfil = alta === "pendiente" ? null : { ...alta, nombre: alta.nombre.trim() };
  const valor = perfil === null ? "pendiente" : JSON.stringify(perfil);
  window.sessionStorage.setItem(CLAVE, valor);
  fotoCrudo = undefined;
  window.dispatchEvent(new Event(EVENTO));
}

export function useFotoAlta(): FotoAlta {
  return useSyncExternalStore(suscribirAlta, leerFotoAlta, () => FOTO_SERVIDOR);
}

function decisionRemota(
  nombreRemoto: string | null | undefined,
  altaLocal: AltaLocal | null,
): { mostrarAsistente: boolean; nombre: string } {
  if (nombreRemoto === undefined || nombreRemoto === null) {
    return { mostrarAsistente: false, nombre: "" };
  }
  const remoto = nombreRemoto.trim();
  if (remoto.length > 0) {
    return { mostrarAsistente: false, nombre: remoto };
  }
  const local = nombreLocalTerminado(altaLocal);
  if (local !== null) {
    return { mostrarAsistente: false, nombre: local };
  }
  return { mostrarAsistente: true, nombre: "" };
}

function nombreLocalTerminado(altaLocal: AltaLocal | null): string | null {
  if (altaLocal === null || altaLocal === "pendiente") {
    return null;
  }
  const nombre = altaLocal.nombre.trim();
  return nombre.length > 0 ? nombre : null;
}

function codigoDeFallo(fallo: unknown): string | null {
  if (typeof fallo !== "object" || fallo === null || !("data" in fallo)) {
    return null;
  }
  const data = fallo.data;
  if (typeof data !== "object" || data === null || !("codigo" in data)) {
    return null;
  }
  return typeof data.codigo === "string" ? data.codigo : null;
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
