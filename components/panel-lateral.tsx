import Image from "next/image";
import Link from "next/link";
import { EtiquetaDemo } from "@/components/etiqueta-demo";
import { cn } from "@/lib/utils";

export function PanelLateral({
  modo,
  ruta,
}: {
  modo: "demo" | "live" | undefined;
  ruta: string;
}) {
  return (
    <aside className="flex flex-col gap-6 border-b border-line bg-white px-4 py-4 md:min-h-screen md:border-b-0 md:border-r md:px-5 md:py-6">
      <div className="flex items-center justify-between gap-3">
        <Link href="/panel" className="inline-flex min-h-11 items-center">
          <Image src="/brand/payvro-logo-claro.svg" alt="PAYVRO" width={140} height={28} priority />
        </Link>
        {modo === "demo" ? <EtiquetaDemo /> : null}
      </div>
      <nav className="flex gap-2 md:flex-col">
        <NavItem
          href="/panel"
          activo={ruta === "/panel" || ruta.startsWith("/panel/cobros") || ruta.startsWith("/panel/nuevo")}
          etiqueta="Cobros"
        />
        <NavItem href="/panel/ajustes" activo={ruta.startsWith("/panel/ajustes")} etiqueta="Ajustes" />
      </nav>
      <Link
        href="/panel/nuevo"
        className="inline-flex min-h-11 items-center justify-center rounded-md bg-petroleo px-4 text-sm font-semibold text-white motion-safe:transition-colors motion-safe:duration-200 motion-safe:ease-out hover:bg-ink"
      >
        Nuevo cobro
      </Link>
    </aside>
  );
}

function NavItem({ href, activo, etiqueta }: { href: string; activo: boolean; etiqueta: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium",
        activo ? "bg-paper text-ink" : "text-muted hover:bg-paper hover:text-ink",
      )}
    >
      {etiqueta}
    </Link>
  );
}
