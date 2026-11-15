"use client";

import type { ReactNode } from "react";
import { AsegurarNegocio } from "@/components/asegurar-negocio";

export default function DuenoLayout({ children }: { children: ReactNode }) {
  return <AsegurarNegocio>{children}</AsegurarNegocio>;
}
