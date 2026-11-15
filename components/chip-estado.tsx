import type { VistaEstado } from "@/lib/estados";
import { cn } from "@/lib/utils";

const CHIP: Record<VistaEstado["chip"], { background: string; color: string }> = {
  amber: { background: "#FFF2C2", color: "#5A4300" },
  teal: { background: "#D6F2F0", color: "#04575F" },
  petroleo: { background: "#076B76", color: "#FFFFFF" },
  orange: { background: "#FFE4CC", color: "#7A3500" },
  neutral: { background: "#EEEBE3", color: "#4A5E6B" },
};

export function ChipEstado({ etiqueta, chip }: VistaEstado) {
  const colores = CHIP[chip];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium",
        "motion-safe:transition-colors motion-safe:duration-200 motion-safe:ease-out",
      )}
      style={{ backgroundColor: colores.background, color: colores.color }}
    >
      <span className="size-2 shrink-0 rounded-full bg-current" aria-hidden="true" />
      {etiqueta}
    </span>
  );
}
