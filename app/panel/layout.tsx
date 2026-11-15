"use client";

import { useQuery } from "convex/react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { PanelLateral } from "@/components/panel-lateral";
import { api } from "@/convex/_generated/api";
import { HAY_CONVEX } from "@/lib/hay-convex";

export default function PanelLayout({ children }: { children: ReactNode }) {
  const ruta = usePathname() ?? "/panel";
  const negocio = useQuery(api.negocio.obtener, HAY_CONVEX ? {} : "skip");
  const modo = HAY_CONVEX ? negocio?.modo : undefined;

  return (
    <div className="min-h-screen bg-paper md:grid md:grid-cols-[15rem_minmax(0,1fr)]">
      <PanelLateral modo={modo} ruta={ruta} />
      <main className="min-w-0 px-4 py-6 md:px-8 md:py-8">{children}</main>
    </div>
  );
}
