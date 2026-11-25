import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { nuevoId } from "@payvro/engine/ids";

const tipos = new Set([
  "cobro.creado", "intento.reservado", "pey.llamada", "intento.creado",
  "intento.incierto", "intento.fallido", "intento.descartado", "evento.recibido",
  "pago.verificado", "pago.no_coincide", "pago.duplicado", "cobro.en_revision",
  "cobro.liberado", "cobro.expirado", "cobro.cancelado", "negocio.actualizado",
  "cobros.pausados", "pey.dato_ilegible",
]);
const motivos = new Set([
  "monto_distinto", "destino_distinto", "metodo_no_permitido", "con_propina",
  "duplicado", "pago_tardio", "parcial", "incierto_60s", "cobro_cancelado", "cobro_expirado", "evidencia_ilegible",
]);
const keysPorTipo: Record<string, readonly string[]> = {
  "cobro.creado": ["folio", "montoCentavos"],
  "intento.reservado": ["tipo"],
  "pey.llamada": ["operacion"],
  "pey.dato_ilegible": [],
  "intento.creado": [],
  "intento.incierto": ["causa"],
  "intento.fallido": ["httpStatus"],
  "intento.descartado": ["motivo"],
  "evento.recibido": ["origen"],
  "pago.verificado": [],
  "pago.no_coincide": ["motivo"],
  "pago.duplicado": ["motivo"],
  "cobro.en_revision": ["motivo"],
  "cobro.liberado": [],
  "cobro.expirado": [],
  "cobro.cancelado": [],
  "negocio.actualizado": [],
  "cobros.pausados": ["pausados"],
};

export interface EntradaBitacora {
  negocioId: Id<"negocios">;
  modo: "demo" | "live";
  tipo: string;
  cobroId?: Id<"cobros">;
  intentoId?: Id<"intentos">;
  eventoId?: Id<"eventosPey">;
  pagoId?: Id<"pagos">;
  actor: { tipo: "dueno" | "sistema" | "pey" | "agente" | "pagador" | "simulador"; id?: string };
  estadoAntes?: "borrador" | "esperando_pago" | "pagado_verificado" | "liberado" | "expirado" | "cancelado" | "en_revision";
  estadoDespues?: "borrador" | "esperando_pago" | "pagado_verificado" | "liberado" | "expirado" | "cancelado" | "en_revision";
  detalle: Record<string, unknown>;
  en?: number;
}

function validarDetalle(tipo: string, detalle: Record<string, unknown>): void {
  const permitidas = keysPorTipo[tipo];
  if (!permitidas || Object.keys(detalle).some((key) => !permitidas.includes(key))) {
    throw new ConvexError({ codigo: "TRANSICION_INVALIDA", mensaje: "El detalle de bitácora no está permitido." });
  }
  for (const [key, value] of Object.entries(detalle)) {
    if (key === "motivo" && (typeof value !== "string" || !motivos.has(value))) {
      throw new ConvexError({ codigo: "TRANSICION_INVALIDA", mensaje: "El motivo de bitácora no está permitido." });
    }
    if (key === "tipo" && value !== "qr" && value !== "link") {
      throw new ConvexError({ codigo: "TRANSICION_INVALIDA", mensaje: "El tipo de intento no está permitido." });
    }
    if (key === "operacion" && value !== "crear_qr" && value !== "crear_link") {
      throw new ConvexError({ codigo: "TRANSICION_INVALIDA", mensaje: "La operación de bitácora no está permitida." });
    }
    if (key === "causa" && value !== "timeout" && value !== "red" && value !== "5xx") {
      throw new ConvexError({ codigo: "TRANSICION_INVALIDA", mensaje: "La causa de bitácora no está permitida." });
    }
    if (key === "origen" && value !== "simulador") {
      throw new ConvexError({ codigo: "TRANSICION_INVALIDA", mensaje: "El origen de bitácora no está permitido." });
    }
    if (key === "pausados" && typeof value !== "boolean") {
      throw new ConvexError({ codigo: "TRANSICION_INVALIDA", mensaje: "El estado de pausa no está permitido." });
    }
    if ((key === "folio" || key === "montoCentavos" || key === "httpStatus") && (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)) {
      throw new ConvexError({ codigo: "TRANSICION_INVALIDA", mensaje: "El valor numérico de bitácora no está permitido." });
    }
  }
}

export async function registrar(ctx: MutationCtx, entrada: EntradaBitacora): Promise<string> {
  if (!tipos.has(entrada.tipo)) {
    throw new ConvexError({ codigo: "TRANSICION_INVALIDA", mensaje: "El evento de bitácora no está permitido." });
  }
  validarDetalle(entrada.tipo, entrada.detalle);
  const negocio = await ctx.db.get(entrada.negocioId);
  if (!negocio || negocio.modo !== entrada.modo) {
    throw new ConvexError({ codigo: "MODO_INVALIDO", mensaje: "El modo del negocio no coincide con la instalación." });
  }
  const seq = negocio.seqBitacora + 1;
  await ctx.db.patch(negocio._id, { seqBitacora: seq });
  const publicId = nuevoId("bit_");
  await ctx.db.insert("bitacora", {
    negocioId: entrada.negocioId,
    modo: entrada.modo,
    publicId,
    seq,
    tipo: entrada.tipo,
    ...(entrada.cobroId ? { cobroId: entrada.cobroId } : {}),
    ...(entrada.intentoId ? { intentoId: entrada.intentoId } : {}),
    ...(entrada.eventoId ? { eventoId: entrada.eventoId } : {}),
    ...(entrada.pagoId ? { pagoId: entrada.pagoId } : {}),
    actor: entrada.actor,
    ...(entrada.estadoAntes ? { estadoAntes: entrada.estadoAntes } : {}),
    ...(entrada.estadoDespues ? { estadoDespues: entrada.estadoDespues } : {}),
    detalle: entrada.detalle as {
      folio?: number; montoCentavos?: number; tipo?: "qr" | "link";
      operacion?: "crear_qr" | "crear_link"; causa?: "timeout" | "red" | "5xx"; httpStatus?: number;
      motivo?: "monto_distinto" | "destino_distinto" | "metodo_no_permitido" | "con_propina" | "duplicado" | "pago_tardio" | "parcial" | "incierto_60s" | "cobro_cancelado" | "cobro_expirado" | "evidencia_ilegible";
      origen?: "simulador"; pausados?: boolean;
    },
    en: entrada.en ?? Date.now(),
  });
  return publicId;
}
