import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "default" | "outline" | "ghost";

const variants: Record<ButtonVariant, string> = {
  default: "bg-petroleo text-white hover:bg-ink",
  outline: "border border-line bg-transparent text-ink hover:bg-paper",
  ghost: "bg-transparent text-ink hover:bg-paper",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, type = "button", variant = "default", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex min-h-11 items-center justify-center rounded-md px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-3 focus-visible:outline-petroleo disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        className,
      )}
      {...props}
    />
  ),
);

Button.displayName = "Button";
