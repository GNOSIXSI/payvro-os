"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { BotonNuevoCobro, EnlacesPanel } from "@/components/nav-panel";
import { Avatar } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Sidebar, SidebarInset, SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { EtiquetaDemo } from "@/components/etiqueta-demo";

export function ShellPanel({
  children,
  modo,
  nombre,
}: {
  children: ReactNode;
  modo: "demo" | "live" | undefined;
  nombre: string;
}) {
  return (
    <SidebarProvider>
      <div className="min-h-screen bg-paper">
        {modo === "demo" ? <BandaDemo /> : null}
        <div className="md:flex">
          <Sidebar>
            <BarraLateral nombre={nombre} modo={modo} />
          </Sidebar>
          <SidebarInset>
            <EncabezadoMovil />
            <main className="min-w-0 px-4 py-6 pb-24 md:px-8 md:py-8 md:pb-8">{children}</main>
          </SidebarInset>
        </div>
        <nav aria-label="Secciones" className="fixed inset-x-0 bottom-0 z-10 flex border-t border-line bg-white md:hidden">
          <EnlacesPanel compacto={false} estirar />
        </nav>
      </div>
    </SidebarProvider>
  );
}

function BandaDemo() {
  return (
    <p className="bg-ink px-4 py-2 text-center text-sm text-white" role="status">
      Modo DEMO: estos cobros son de práctica y no se mueve dinero real.
    </p>
  );
}

function BarraLateral({ nombre, modo }: { nombre: string; modo: "demo" | "live" | undefined }) {
  const { colapsado } = useSidebar();
  return (
    <div className="flex h-full flex-col gap-4 px-2 py-4">
      <div className={colapsado ? "flex flex-col items-center gap-1" : "flex items-center justify-between gap-1"}>
        <Link href="/panel" className="inline-flex min-h-11 items-center">
          <Image
            src="/brand/payvro-logo-claro.svg"
            alt=""
            width={colapsado ? 32 : 120}
            height={28}
            className={colapsado ? "h-8 w-8 object-cover object-left" : undefined}
            priority
          />
          <span className="sr-only">PAYVRO</span>
        </Link>
        <SidebarTrigger />
      </div>
      {modo === "demo" && !colapsado ? <EtiquetaDemo /> : null}
      <nav aria-label="Secciones" className="flex flex-col gap-1">
        <EnlacesPanel compacto={colapsado} />
      </nav>
      <BotonNuevoCobro compacto={colapsado} />
      <Separator />
      <div className="mt-auto flex items-center gap-2 px-1">
        <Avatar texto={nombre} />
        <span className={colapsado ? "sr-only" : "truncate text-sm font-medium text-ink"}>{nombre}</span>
      </div>
    </div>
  );
}

function EncabezadoMovil() {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-paper px-4 py-2 md:hidden">
      <Link href="/panel" className="inline-flex min-h-11 min-w-0 items-center">
        <Image src="/brand/payvro-logo-claro.svg" alt="PAYVRO" width={112} height={24} priority />
      </Link>
      <BotonNuevoCobro compacto={false} />
    </header>
  );
}
