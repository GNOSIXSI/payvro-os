import { encode } from "uqr";

function pathDeQr(valor: string): { path: string; size: number } {
  const qr = encode(valor, { ecc: "M", border: 2 });
  const partes: string[] = [];
  for (let y = 0; y < qr.size; y += 1) {
    const fila = qr.data[y];
    if (!fila) {
      continue;
    }
    for (let x = 0; x < fila.length; x += 1) {
      if (fila[x]) {
        partes.push(`M${x} ${y}h1v1h-1z`);
      }
    }
  }
  return { path: partes.join(""), size: qr.size };
}

export function QrCodi({ valor, caption }: { valor: string; caption: string }) {
  const { path, size } = pathDeQr(valor);
  return (
    <figure className="mx-auto w-full max-w-[16rem]">
      <svg
        role="img"
        aria-label="Código QR CoDi"
        viewBox={`0 0 ${size} ${size}`}
        className="h-auto w-full bg-white"
      >
        <path d={path} fill="#142B3B" />
      </svg>
      <figcaption className="mt-3 text-center text-sm text-muted">{caption}</figcaption>
    </figure>
  );
}
