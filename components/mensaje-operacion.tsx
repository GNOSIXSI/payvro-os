export function MensajeOperacion({ texto }: { texto: string }) {
  return (
    <p role="alert" className="text-sm font-medium text-magenta">
      {texto}
    </p>
  );
}
