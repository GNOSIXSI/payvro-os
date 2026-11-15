const AVISO = "El link de pago aún no está disponible";
const cache = new Map<string, DestinoCopia>();

export type UbicacionCopia = {
  protocol: string;
  hostname: string;
  origin: string;
};

export type DestinoCopia =
  | { disponible: true; etiqueta: string; texto: string }
  | { disponible: false; aviso: typeof AVISO };

export function destinoDeCopia(
  publicId: string,
  urlPago: string | undefined,
  ubicacion: UbicacionCopia = ubicacionActual(),
): DestinoCopia {
  const clave = [
    publicId,
    urlPago ?? "",
    ubicacion.protocol,
    ubicacion.hostname,
    ubicacion.origin,
  ].join("\0");
  const previo = cache.get(clave);
  if (previo) {
    return previo;
  }
  const destino = armarDestino(publicId, urlPago, ubicacion);
  cache.set(clave, destino);
  return destino;
}

function armarDestino(
  publicId: string,
  urlPago: string | undefined,
  ubicacion: UbicacionCopia,
): DestinoCopia {
  const esLocal = ubicacion.hostname === "localhost" || ubicacion.hostname === "127.0.0.1";
  if (ubicacion.protocol === "https:" && !esLocal) {
    return {
      disponible: true,
      etiqueta: "Copiar link",
      texto: `${ubicacion.origin}/pagar/${publicId}`,
    };
  }
  if (urlPago) {
    return { disponible: true, etiqueta: "Copiar link de pey", texto: urlPago };
  }
  return { disponible: false, aviso: AVISO };
}

function ubicacionActual(): UbicacionCopia {
  return {
    protocol: window.location.protocol,
    hostname: window.location.hostname,
    origin: window.location.origin,
  };
}
