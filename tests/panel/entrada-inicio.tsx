import { ConvexProvider, ConvexReactClient } from "convex/react";
import { createRoot } from "react-dom/client";
import PanelPage from "../../app/panel/page";

type Fila = {
  publicId: string;
  folio: number;
  concepto: string;
  montoCentavos: number;
  estado: string;
  creadoEn: number;
};

type Pagina = {
  page: Fila[];
  isDone: boolean;
  continueCursor: string;
};

type Resumen = {
  verificadoHoyCentavos: number;
  porLiberar: number;
  enRevision: number;
};

type Escena = {
  resumen: Resumen;
  paginas: Record<string, Pagina>;
};

type Consulta = {
  ruta: string;
  cursor: string | null;
};

type Version = {
  querySet: number;
  ts: number;
  identity: number;
};

type Modificacion =
  | { type: "Add"; queryId: number; udfPath: string; args: unknown[] }
  | { type: "Remove"; queryId: number };

const escenaInicial = (window as VentanaInicio).__escena;
const errores: string[] = [];
const consultas = new Map<number, Consulta>();
const sockets: SocketFrontera[] = [];
let version: Version = { querySet: 0, ts: 0, identity: 0 };
let resumen = escenaInicial.resumen;
const paginas: Record<string, Pagina> = { ...escenaInicial.paginas };

window.addEventListener("error", (evento) => {
  errores.push(String(evento.error ?? evento.message));
});

class SocketFrontera {
  onopen: (() => void) | null = null;
  onmessage: ((evento: { data: string }) => void) | null = null;
  onerror: ((evento: { message?: string }) => void) | null = null;
  onclose: ((evento: { code: number; reason: string }) => void) | null = null;
  url: string;

  constructor(url: string) {
    this.url = url;
    sockets.push(this);
    queueMicrotask(() => {
      this.onopen?.();
    });
  }

  send(datos: string): void {
    recibir(datos);
  }

  close(): void {
    this.onclose?.({ code: 1000, reason: "" });
  }
}

function recibir(datos: string): void {
  const mensaje = JSON.parse(datos) as { type?: string; baseVersion?: number; newVersion?: number; modifications?: Modificacion[] };
  if (mensaje.type !== "ModifyQuerySet" || mensaje.modifications === undefined || mensaje.newVersion === undefined) {
    return;
  }
  const altas: Modificacion[] = [];
  for (const cambio of mensaje.modifications) {
    if (cambio.type === "Remove") {
      consultas.delete(cambio.queryId);
    }
    if (cambio.type === "Add") {
      consultas.set(cambio.queryId, { ruta: cambio.udfPath, cursor: cursorDe(cambio.args) });
      altas.push(cambio);
    }
  }
  emitir(mensaje.newVersion, altas.flatMap((cambio) => (cambio.type === "Add" ? [actualizacion(cambio.queryId)] : [])));
}

function reemplazarLista(cursor: string | null, pagina: Pagina, resumenNuevo?: Resumen): void {
  paginas[claveCursor(cursor)] = pagina;
  if (resumenNuevo) {
    resumen = resumenNuevo;
  }
  const cambios = [];
  for (const [id, consulta] of consultas) {
    if (consulta.ruta.endsWith(":listar") && consulta.cursor === cursor) {
      cambios.push(actualizacion(id));
    }
    if (resumenNuevo && consulta.ruta.endsWith(":resumenDelDia")) {
      cambios.push(actualizacion(id));
    }
  }
  emitir(version.querySet, cambios);
}

function actualizacion(queryId: number): {
  type: "QueryUpdated";
  queryId: number;
  value: Pagina | Resumen;
  logLines: string[];
  journal: null;
} {
  const consulta = consultas.get(queryId);
  const value = consulta?.ruta.endsWith(":listar") ? paginaDe(consulta.cursor) : resumen;
  return { type: "QueryUpdated", queryId, value, logLines: [], journal: null };
}

function paginaDe(cursor: string | null): Pagina {
  return (
    paginas[claveCursor(cursor)] ?? {
      page: [],
      isDone: true,
      continueCursor: "",
    }
  );
}

function emitir(
  querySet: number,
  modifications: {
    type: "QueryUpdated";
    queryId: number;
    value: Pagina | Resumen;
    logLines: string[];
    journal: null;
  }[],
): void {
  const inicio = version;
  version = { querySet, ts: inicio.ts + 1, identity: inicio.identity };
  const mensaje = {
    type: "Transition",
    startVersion: codificar(inicio),
    endVersion: codificar(version),
    modifications,
  };
  sockets[0]?.onmessage?.({ data: JSON.stringify(mensaje) });
}

function codificar(marca: Version): { querySet: number; ts: string; identity: number } {
  return { querySet: marca.querySet, ts: u64(marca.ts), identity: marca.identity };
}

function u64(valor: number): string {
  const bytes = new Uint8Array(8);
  let resto = valor;
  for (let indice = 0; indice < bytes.length; indice += 1) {
    bytes[indice] = resto % 256;
    resto = Math.floor(resto / 256);
  }
  let binario = "";
  for (const byte of bytes) {
    binario += String.fromCharCode(byte);
  }
  return btoa(binario);
}

function cursorDe(args: unknown[]): string | null {
  const primero = args[0];
  if (!primero || typeof primero !== "object" || !("paginationOpts" in primero)) {
    return null;
  }
  const opts = primero.paginationOpts;
  if (!opts || typeof opts !== "object" || !("cursor" in opts)) {
    return null;
  }
  return typeof opts.cursor === "string" ? opts.cursor : null;
}

function claveCursor(cursor: string | null): string {
  return cursor ?? "";
}

type VentanaInicio = Window & {
  __escena: Escena;
  __inicio: {
    errores: string[];
    reemplazarLista: (cursor: string | null, pagina: Pagina, resumenNuevo?: Resumen) => void;
  };
};

(window as VentanaInicio).__inicio = { errores, reemplazarLista };

const raiz = document.getElementById("root");
if (!raiz) {
  throw new Error("falta #root");
}

const cliente = new ConvexReactClient("https://happy-animal-123.convex.cloud", {
  webSocketConstructor: SocketFrontera as unknown as typeof WebSocket,
  unsavedChangesWarning: false,
  skipConvexDeploymentUrlCheck: true,
  logger: false,
});

createRoot(raiz).render(
  <ConvexProvider client={cliente}>
    <PanelPage />
  </ConvexProvider>,
);
