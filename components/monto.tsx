import { formatoMXN } from "@/lib/formato";
import { cn } from "@/lib/utils";

export function Monto({
  centavos,
  className,
}: {
  centavos: number;
  className?: string;
}) {
  return (
    <span className={cn("whitespace-nowrap tabular-nums", className)}>{formatoMXN(centavos)}</span>
  );
}
