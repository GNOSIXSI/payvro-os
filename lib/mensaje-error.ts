export function mensajeDeError(error: unknown): string {
  if (typeof error === "object" && error !== null && "data" in error) {
    const data = (error as { data: unknown }).data;
    if (typeof data === "object" && data !== null && "mensaje" in data) {
      const mensaje = (data as { mensaje: unknown }).mensaje;
      if (typeof mensaje === "string" && mensaje.length > 0) {
        return mensaje;
      }
    }
  }
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }
  return "No se pudo completar la operación.";
}
