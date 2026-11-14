export const PREFIJOS_ID = ["neg_", "cob_", "int_", "evt_", "bit_", "pag_"] as const;

export type PrefijoId = (typeof PREFIJOS_ID)[number];

const ALFABETO_CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const CARACTERES_ID = /^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{26}$/;
const MAX_BYTE_SIN_RECHAZO = 224;
const LARGO_ID = 26;

export function nuevoId(prefijo: PrefijoId): string {
  if (!PREFIJOS_ID.includes(prefijo)) {
    throw new TypeError("PREFIJO_INVALIDO");
  }

  const caracteres: string[] = [];

  while (caracteres.length < LARGO_ID) {
    const faltantes = LARGO_ID - caracteres.length;
    const bytes = new Uint8Array(Math.ceil(faltantes * (256 / MAX_BYTE_SIN_RECHAZO)));
    globalThis.crypto.getRandomValues(bytes);

    for (const byte of bytes) {
      if (byte < MAX_BYTE_SIN_RECHAZO) {
        caracteres.push(ALFABETO_CROCKFORD[byte % ALFABETO_CROCKFORD.length]);
        if (caracteres.length === LARGO_ID) {
          break;
        }
      }
    }
  }

  return `${prefijo}${caracteres.join("")}`;
}

export function esId(prefijo: string, valor: unknown): valor is string {
  if (!PREFIJOS_ID.some((prefijoValido) => prefijoValido === prefijo)) {
    return false;
  }

  if (typeof valor !== "string" || !valor.startsWith(prefijo)) {
    return false;
  }

  return CARACTERES_ID.test(valor.slice(prefijo.length));
}
