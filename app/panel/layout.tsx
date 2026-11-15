"use client";

import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { decidirAlta, useFotoAlta } from "@/components/alta-local";
import { ShellPanel } from "@/components/shell-panel";
import { api } from "@/convex/_generated/api";
import { HAY_CONVEX } from "@/lib/hay-convex";

export default function PanelLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const foto = useFotoAlta();
  const negocio = useQuery(api.negocio.obtener, HAY_CONVEX ? {} : "skip");
  const decision = decidirAlta({
    hayConvex: HAY_CONVEX,
    nombreRemoto: negocio?.nombre,
    altaLocal: foto.alta,
    nombreDemo: "",
  });
  const modo = HAY_CONVEX ? negocio?.modo : undefined;

  useEffect(() => {
    if (foto.lista && decision.mostrarAsistente) {
      router.replace("/bienvenida");
    }
  }, [foto.lista, decision.mostrarAsistente, router]);

  return (
    <ShellPanel modo={modo} nombre={decision.nombre}>
      {children}
    </ShellPanel>
  );
}
