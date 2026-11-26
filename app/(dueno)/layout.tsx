import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { ConvexError } from "convex/values";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AsegurarNegocio } from "@/components/asegurar-negocio";
import { api } from "@/convex/_generated/api";
import { ProveedorDueno } from "../providers";

const aviso = (texto: string) => <p className="px-6 py-12 text-ink" role="status">{texto}</p>;

export default async function DuenoLayout({ children }: { children: ReactNode }) {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) return <AsegurarNegocio>{children}</AsegurarNegocio>;

  const client = new ConvexHttpClient(url, {
    logger: false,
    fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
  });
  const instalacion = await client.query(api.publico.instalacion, {}).catch(() => null);
  if (instalacion?.modo === "demo") return <AsegurarNegocio>{children}</AsegurarNegocio>;
  if (instalacion?.modo !== "live") return aviso("No se pudo consultar el modo de la instalación.");

  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || !process.env.CLERK_SECRET_KEY) {
    return aviso("El acceso al panel todavía no está configurado.");
  }
  const sesion = await auth();
  if (!sesion.isAuthenticated) redirect("/entrar");

  try {
    const token = await sesion.getToken({ template: "convex" });
    if (!token) return aviso("No se pudo validar tu sesión para el panel.");
    client.setAuth(token);
    await client.query(api.negocio.obtener, {});
  } catch (error) {
    if (error instanceof ConvexError && error.data?.codigo === "NO_AUTORIZADO") {
      return aviso("No tienes permiso para operar este negocio.");
    }
    if (error instanceof ConvexError && error.data?.codigo === "NO_ENCONTRADO") {
      return aviso("El negocio todavía no está configurado. Pide al administrador que complete la instalación.");
    }
    return aviso("No se pudo cargar la cuenta.");
  }

  return <ProveedorDueno>{children}</ProveedorDueno>;
}
