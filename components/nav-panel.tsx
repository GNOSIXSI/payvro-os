"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const ENTRADAS = [
  { href: "/panel", etiqueta: "Inicio", clave: "inicio" },
  { href: "/panel#cobros", etiqueta: "Cobros", clave: "cobros" },
  { href: "/panel/ajustes", etiqueta: "Ajustes", clave: "ajustes" },
] as const;

export function EnlacesPanel({ compacto, estirar = false }: { compacto: boolean; estirar?: boolean }) {
  const { ruta, hash } = useRutaPanel();
  return (
    <>
      {ENTRADAS.map((entrada) => (
        <Enlace
          key={entrada.clave}
          href={entrada.href}
          etiqueta={entrada.etiqueta}
          activo={activoDe(entrada.clave, ruta, hash)}
          compacto={compacto}
          estirar={estirar}
        >
          <Icono clave={entrada.clave} />
        </Enlace>
      ))}
    </>
  );
}

export function BotonNuevoCobro({ compacto }: { compacto: boolean }) {
  return (
    <Link
      href="/panel/nuevo"
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-petroleo px-3 text-sm font-semibold text-white hover:bg-ink"
    >
      <IconoMas />
      <span className={compacto ? "sr-only" : undefined}>Nuevo cobro</span>
    </Link>
  );
}

export function activoDe(clave: string, ruta: string, hash: string): boolean {
  if (clave === "ajustes") {
    return ruta.startsWith("/panel/ajustes");
  }
  if (clave === "cobros") {
    return hash === "#cobros" || ruta.startsWith("/panel/cobros");
  }
  return ruta === "/panel" && hash !== "#cobros";
}

function Enlace({
  href,
  etiqueta,
  activo,
  compacto,
  estirar,
  children,
}: {
  href: string;
  etiqueta: string;
  activo: boolean;
  compacto: boolean;
  estirar: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={activo ? "page" : undefined}
      className={cn(
        "inline-flex min-h-11 min-w-11 items-center gap-2 rounded-md px-3 text-sm font-medium",
        estirar ? "flex-1 justify-center" : undefined,
        activo ? "bg-paper text-ink" : "text-muted hover:bg-paper hover:text-ink",
      )}
    >
      {children}
      <span className={compacto ? "sr-only" : undefined}>{etiqueta}</span>
    </Link>
  );
}

function useRutaPanel(): { ruta: string; hash: string } {
  const ruta = usePathname() ?? "/panel";
  const [hash, setHash] = useState("");

  useEffect(() => {
    const leer = () => setHash(window.location.hash);
    leer();
    window.addEventListener("hashchange", leer);
    return () => window.removeEventListener("hashchange", leer);
  }, [ruta]);

  return { ruta, hash };
}

function Icono({ clave }: { clave: string }) {
  if (clave === "cobros") {
    return <IconoLista />;
  }
  if (clave === "ajustes") {
    return <IconoAjustes />;
  }
  return <IconoInicio />;
}

function IconoInicio() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" />
    </svg>
  );
}

function IconoLista() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8 7h12M8 12h12M8 17h12M4 7h.01M4 12h.01M4 17h.01" />
    </svg>
  );
}

function IconoAjustes() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
    </svg>
  );
}

function IconoMas() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
