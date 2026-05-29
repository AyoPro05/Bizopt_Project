import { cn } from "@/lib/helpers";
import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  ariaLabel?: string;
  ariaDescribedBy?: string;
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type,
      spellCheck,
      autoComplete,
      ariaLabel,
      ariaDescribedBy,
      error = false,
      disabled = false,
      required = false,
      ...props
    },
    ref
  ) => (
    <input
      ref={ref}
      type={type}
      disabled={disabled}
      required={required}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      aria-invalid={error}
      spellCheck={type === "password" ? false : spellCheck}
      autoComplete={
        autoComplete ?? (type === "password" ? "current-password" : undefined)
      }
      className={cn(
        "block w-full rounded-xl border bg-white px-4 py-2.5 text-sm text-[var(--color-ink)] outline-none transition-all duration-200",
        error
          ? "border-[var(--color-danger)] focus:border-[var(--color-danger)] focus:ring-2 focus:ring-red-200"
          : "border-[var(--color-border)] focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent-soft)]",
        disabled &&
          "cursor-not-allowed bg-[var(--color-surface)] opacity-60",
        type === "password" && "font-mono tracking-wide",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";
