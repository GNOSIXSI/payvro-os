"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type SidebarEstado = {
  colapsado: boolean;
  alternar: () => void;
};

const SidebarContexto = createContext<SidebarEstado | null>(null);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [colapsado, setColapsado] = useState(false);
  const alternar = () => setColapsado((actual) => !actual);
  return <SidebarContexto.Provider value={{ colapsado, alternar }}>{children}</SidebarContexto.Provider>;
}

export function useSidebar(): SidebarEstado {
  const valor = useContext(SidebarContexto);
  if (!valor) {
    throw new Error("El menú lateral está fuera de su proveedor.");
  }
  return valor;
}

export function Sidebar({ children }: { children: ReactNode }) {
  const { colapsado } = useSidebar();
  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-dvh shrink-0 flex-col overflow-y-auto border-r border-line bg-white md:flex",
        colapsado ? "w-16" : "w-60",
      )}
    >
      {children}
    </aside>
  );
}

export function SidebarInset({ children }: { children: ReactNode }) {
  return <div className="min-w-0 flex-1">{children}</div>;
}

export function SidebarTrigger() {
  const { colapsado, alternar } = useSidebar();
  const etiqueta = colapsado ? "Expandir menú" : "Contraer menú";
  return (
    <button
      type="button"
      className="inline-flex size-11 items-center justify-center rounded-md text-ink hover:bg-paper"
      aria-pressed={colapsado}
      aria-label={etiqueta}
      onClick={alternar}
    >
      <IconoMenu />
    </button>
  );
}

function IconoMenu() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}
