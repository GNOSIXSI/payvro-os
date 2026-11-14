import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "demo" | "outline";

const variants: Record<BadgeVariant, string> = {
  default: "border-transparent bg-petroleo text-white",
  demo: "border-transparent bg-yellow text-ink",
  outline: "border-line bg-transparent text-ink",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold tracking-wide",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
