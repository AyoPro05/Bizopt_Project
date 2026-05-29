import { cn } from "@/lib/helpers";
import { ButtonHTMLAttributes, forwardRef } from "react";
import { LoadingSpinner } from "./loading-spinner";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  ariaLabel?: string;
}

const variants: Record<Variant, string> = {
  primary:
    "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] hover:shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed",
  secondary:
    "bg-white text-[var(--color-ink)] border border-[var(--color-border)] hover:bg-[var(--color-surface)] hover:shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed",
  ghost: "text-[var(--color-ink-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed",
  danger: "bg-[var(--color-danger)] text-white hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed",
};

const sizes: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2.5 text-sm",
  lg: "px-6 py-3 text-base",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      loading = false,
      disabled = false,
      ariaLabel,
      children,
      ...props
    },
    ref
  ) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-label={ariaLabel}
      aria-busy={loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {loading && <LoadingSpinner size="sm" label="" />}
      {children}
    </button>
  )
);
Button.displayName = "Button";
