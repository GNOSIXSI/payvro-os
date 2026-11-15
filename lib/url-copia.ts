const AVISO = "El link de pago aún no está disponible";

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
