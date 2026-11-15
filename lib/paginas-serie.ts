export const TAMANO_PAGINA_SERIE = 50;
export const MAX_PAGINAS_SERIE = 10;

export type PaginaLista<T> = {
  page: readonly T[];
  isDone: boolean;
  continueCursor: string;
};

export type EstadoPaginas<T> = {
  filas: T[];
  paginas: number;
  parcial: boolean;
  cursor: string | null;
  completo: boolean;
  token: string | null;
};

export function estadoPaginasVacio<T>(): EstadoPaginas<T> {
  return { filas: [], paginas: 0, parcial: false, cursor: null, completo: false, token: null };
}

export function incorporarSiNueva<T>(estado: EstadoPaginas<T>, pagina: PaginaLista<T>): EstadoPaginas<T> {
  if (estado.completo) {
    return estado;
  }
  const token = tokenDe(estado.cursor, pagina);
  if (token === estado.token) {
    return estado;
  }
  const paginas = estado.paginas + 1;
  const seguir = !pagina.isDone && paginas < MAX_PAGINAS_SERIE;
  return {
    filas: estado.filas.concat(pagina.page),
    paginas,
    parcial: !pagina.isDone && !seguir,
    cursor: seguir ? pagina.continueCursor : estado.cursor,
    completo: !seguir,
    token,
  };
}

export function juntarPaginas<T>(paginas: readonly PaginaLista<T>[]): EstadoPaginas<T> {
  let estado = estadoPaginasVacio<T>();
  for (const pagina of paginas) {
    if (estado.completo) {
      break;
    }
    estado = incorporarSiNueva(estado, pagina);
  }
  return estado;
}

function tokenDe(cursor: string | null, pagina: PaginaLista<unknown>): string {
  return `${cursor ?? ""}|${pagina.continueCursor}|${pagina.page.length}|${pagina.isDone ? 1 : 0}`;
}
