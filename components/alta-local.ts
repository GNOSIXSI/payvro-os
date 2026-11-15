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

export type AltaLocal = AltaGuardada | "pendiente" | "omitido";

export function cerrarAlta(
  accion: "guardar" | "omitir",
  fallo: unknown | null,
): { navegar: boolean; marcarOmitido: boolean; mostrarError: boolean } {
  if (accion === "omitir") {
    return { navegar: true, marcarOmitido: true, mostrarError: false };
  }
  if (fallo !== null) {
    return { navegar: false, marcarOmitido: false, mostrarError: true };
  }
  return { navegar: true, marcarOmitido: false, mostrarError: false };
}

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

export function debeSalirDeBienvenida(entrada: {
  lista: boolean;
  esperandoPerfil: boolean;
  mostrarAsistente: boolean;
}): boolean {
  if (!entrada.lista || entrada.esperandoPerfil) {
    return false;
  }
  return !entrada.mostrarAsistente;
}

export function interpretarAlta(crudo: string | null): AltaLocal | null {
  if (crudo === null) {
    return null;
  }
  if (crudo === "pendiente" || crudo === "omitido") {
    return crudo;
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
  window.sessionStorage.setItem(CLAVE, serializarAlta(alta));
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
  if (altaLocal === "omitido") {
    return { mostrarAsistente: false, nombre: PERFIL_OMITIDO.nombre };
  }
  return { mostrarAsistente: true, nombre: "" };
}

function decisionLocal(
  altaLocal: AltaLocal | null,
  nombreDemo: string,
): { mostrarAsistente: boolean; nombre: string } {
  if (altaLocal === "pendiente") {
    return { mostrarAsistente: true, nombre: "" };
  }
  if (altaLocal === "omitido") {
    return { mostrarAsistente: false, nombre: PERFIL_OMITIDO.nombre };
  }
  if (altaLocal && altaLocal.nombre.trim().length > 0) {
    return { mostrarAsistente: false, nombre: altaLocal.nombre.trim() };
  }
  return { mostrarAsistente: false, nombre: nombreDemo };
}

function serializarAlta(alta: AltaLocal): string {
  if (alta === "pendiente" || alta === "omitido") {
    return alta;
  }
  return JSON.stringify({ ...alta, nombre: alta.nombre.trim() });
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
