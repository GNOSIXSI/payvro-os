"use client";

import { useMutation } from "convex/react";
import { useEffect } from "react";
import { api } from "@/convex/_generated/api";
import { HAY_CONVEX } from "@/lib/hay-convex";

export function useSondeo(publicId: string | undefined, activo: boolean) {
  const vigilar = useMutation(api.publico.vigilar);

  useEffect(() => {
    if (!HAY_CONVEX || !activo || !publicId) {
      return;
    }
    let cancelado = false;
    const latido = async () => {
      if (cancelado || document.visibilityState !== "visible") {
        return;
      }
      try {
        await vigilar({ publicId });
      } catch {
        return;
      }
    };
    void latido();
    const id = window.setInterval(() => {
      void latido();
    }, 10_000);
    const alVisibilidad = () => {
      if (document.visibilityState === "visible") {
        void latido();
      }
    };
    document.addEventListener("visibilitychange", alVisibilidad);
    return () => {
      cancelado = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", alVisibilidad);
    };
  }, [publicId, activo, vigilar]);
}
