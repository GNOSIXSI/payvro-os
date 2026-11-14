export function destinoDeCopia(publicId: string, urlPago: string | undefined): {
  etiqueta: string;
  texto: string;
} {
  const anfitrion = window.location.hostname;
  const esLocal = anfitrion === "localhost" || anfitrion === "127.0.0.1";
  const paginaPayvro = `${window.location.origin}/pagar/${publicId}`;

  if (window.location.protocol === "https:" && !esLocal) {
    return { etiqueta: "Copiar link", texto: paginaPayvro };
  }
  if (urlPago) {
    return { etiqueta: "Copiar link de pey", texto: urlPago };
  }
  return { etiqueta: "Copiar link", texto: paginaPayvro };
}
