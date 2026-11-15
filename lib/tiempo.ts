const FECHA_HORA = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatoFechaHora(en: number): string {
  return FECHA_HORA.format(new Date(en));
}
