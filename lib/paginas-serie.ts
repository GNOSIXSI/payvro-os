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
};

export function serieDeRecibidas<T>(paginas: readonly (PaginaLista<T> | null)[]): EstadoPaginas<T> {
  const filas: T[] = [];
  let cuenta = 0;
  let ultima: PaginaLista<T> | null = null;
  for (const pagina of paginas) {
    if (pagina === null || cuenta >= MAX_PAGINAS_SERIE) {
      break;
    }
    for (const fila of pagina.page) {
      filas.push(fila);
    }
    ultima = pagina;
    cuenta += 1;
  }
  const hayMas = ultima !== null && !ultima.isDone;
  const tope = cuenta >= MAX_PAGINAS_SERIE && hayMas;
  return {
    filas,
    paginas: cuenta,
    parcial: tope,
    cursor: null,
    completo: ultima !== null && (!hayMas || tope),
  };
}

export function cursoresActivos<T>(paginas: readonly (PaginaLista<T> | null)[]): (string | null)[] {
  const cursores: (string | null)[] = [];
  let cursor: string | null = null;
  for (let indice = 0; indice < MAX_PAGINAS_SERIE; indice += 1) {
    cursores.push(cursor);
    const pagina = paginas[indice] ?? null;
    if (pagina === null || pagina.isDone) {
      break;
    }
    cursor = pagina.continueCursor;
  }
  return cursores;
}

export function juntarPaginas<T>(paginas: readonly PaginaLista<T>[]): EstadoPaginas<T> {
  const recibidas: PaginaLista<T>[] = [];
  for (const pagina of paginas) {
    if (recibidas.length >= MAX_PAGINAS_SERIE) {
      break;
    }
    recibidas.push(pagina);
    if (pagina.isDone) {
      break;
    }
  }
  return serieDeRecibidas(recibidas);
}
