"use client";

import Image from "next/image";
import Link from "next/link";
import { useQuery } from "convex/react";
import { Badge } from "@/components/ui/badge";
import { api } from "@/convex/_generated/api";
import { MODO_SIN_DEPLOYMENT } from "@/lib/modo";

const hasConvexDeployment = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);

export default function HomePage() {
  const negocio = useQuery(api.negocio.obtener, hasConvexDeployment ? {} : "skip");
  const modo = negocio?.modo ?? (hasConvexDeployment ? undefined : MODO_SIN_DEPLOYMENT);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center justify-center gap-8 px-6 py-16 text-center">
      <Image
        src="/brand/payvro-logo-claro.svg"
        alt="PAYVRO"
        width={320}
        height={65}
        priority
      />
      <h1 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-5xl">
        Cobra y libera, sin comprobantes.
      </h1>
      {modo === "demo" ? <Badge variant="demo">DEMO</Badge> : null}
      <Link
        href="/panel"
        className="inline-flex min-h-11 items-center justify-center rounded-md bg-petroleo px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-ink focus-visible:outline-offset-4"
      >
        Ir al panel
      </Link>
    </main>
  );
}
