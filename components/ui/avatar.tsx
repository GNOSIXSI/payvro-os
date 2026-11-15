export function Avatar({ texto }: { texto: string }) {
  const inicial = texto.trim().charAt(0).toUpperCase() || "P";
  return (
    <span
      aria-hidden="true"
      className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-petroleo text-sm font-semibold text-white"
    >
      {inicial}
    </span>
  );
}
